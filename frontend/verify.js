const ProposalState = {
  0: "ACCEPTED",
  1: "ACCEPTING",
  2: "WAITING",
  3: "REJECTED",
};

App = {
  crypt: "",
  param: "",
  URL: "https://ipfs.io/ipfs/",
  web3: null,
  account: null,
  contract: null,
  proposalId: null,

  load: async () => {
    await App.loadWeb3();
    await App.loadAccount();
    await App.loadContract();
    await App.loadDetails();
  },

  loadWeb3: async () => {
    if (window.ethereum) {
      App.web3 = new Web3(window.ethereum);
      try {
        await window.ethereum.enable();
      } catch (error) {
        console.error("User denied account access");
      }
    } else if (window.web3) {
      App.web3 = new Web3(window.web3.currentProvider);
    } else {
      alert("Please install MetaMask to use this application");
    }
  },

  loadAccount: async () => {
    if (App.web3) {
      const accounts = await App.web3.eth.getAccounts();
      App.account = accounts[0];
    }
  },

  loadContract: async () => {
    if (App.web3) {
      const contractAddress = "YOUR_CONTRACT_ADDRESS"; // Replace with your contract address
      const contractABI = []; // Replace with your contract ABI
      App.contract = new App.web3.eth.Contract(contractABI, contractAddress);
    }
  },

  loadDetails: async () => {
    try {
    let searchParams = new URLSearchParams(window.location.search);
    App.param = searchParams.get("a");

      if (!App.param) {
        throw new Error("No proposal ID provided");
      }

      // Get the specific proposal
      const proposal = await App.contract.methods.proposals(App.param).call();

      if (!proposal || !proposal.borrower) {
        throw new Error("Proposal not found");
      }

      await App.updateProposalDetails(proposal);
    } catch (error) {
      console.error("Error loading details:", error);
      alert("Error loading proposal details: " + error.message);
    }
  },

  updateProposalDetails: async (proposal) => {
    try {
      // Update basic proposal details
      document.getElementById("proposalId").textContent = App.param;
      document.getElementById("borrowerAddress").textContent =
        proposal.borrower;
      document.getElementById("requestedAmount").textContent =
        App.web3.utils.fromWei(proposal.amount, "ether") + " ETH";
      document.getElementById("loanTerm").textContent = proposal.time + " days";
      document.getElementById("interestRate").textContent =
        proposal.interestRate + "%";

      // Update status
      const statusBadge = document.getElementById("proposalStatus");
      statusBadge.textContent = ProposalState[proposal.state];
      statusBadge.className =
        "status-badge " +
        (proposal.state === 0
          ? "bg-success"
          : proposal.state === 3
          ? "bg-danger"
          : proposal.state === 2
          ? "bg-warning"
          : "bg-info");

      // Load collateral details if available
      if (proposal.collateral) {
        const collateralDetails = await App.contract.methods
          .getCollateralDetails(proposal.collateral)
          .call();

        // Update collateral details
        document.getElementById("collateralType").textContent =
          collateralDetails.assetType;
        document.getElementById("assetAddress").textContent =
          collateralDetails.assetAddress;
        document.getElementById("assetValue").textContent =
          App.web3.utils.fromWei(collateralDetails.assetValue, "ether") +
          " ETH";
        document.getElementById("documentHash").textContent =
          collateralDetails.documentHash;
        document.getElementById("lastValuation").textContent = new Date(
          collateralDetails.lastValuation * 1000
        ).toLocaleDateString();

        // Update verification status
        const verificationStatus =
          document.getElementById("verificationStatus");
        verificationStatus.textContent = collateralDetails.isVerified
          ? "Verified"
          : "Not Verified";
        verificationStatus.className = `status-badge ${
          collateralDetails.isVerified ? "bg-success" : "bg-warning"
        }`;
      }

      // Update button states based on proposal state
      const approveBtn = document.getElementById("approveBtn");
      const rejectBtn = document.getElementById("rejectBtn");

      if (proposal.state === 2) {
        // WAITING state
        approveBtn.disabled = false;
        rejectBtn.disabled = false;
      } else {
        approveBtn.disabled = true;
        rejectBtn.disabled = true;
        if (proposal.state === 0) {
          // ACCEPTED
          approveBtn.innerHTML = '<i class="fas fa-check-circle"></i> Approved';
          rejectBtn.innerHTML =
            '<i class="fas fa-times-circle"></i> Reject Loan';
        } else if (proposal.state === 3) {
          // REJECTED
          approveBtn.innerHTML =
            '<i class="fas fa-check-circle"></i> Approve Loan';
          rejectBtn.innerHTML = '<i class="fas fa-times-circle"></i> Rejected';
        }
      }
    } catch (error) {
      console.error("Error updating proposal details:", error);
      alert("Error updating proposal details: " + error.message);
    }
  },

  approveLoan: async () => {
    if (!App.contract || !App.account) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      await App.contract.methods
        .approveProposal(App.param)
        .send({ from: App.account });
      alert("Loan proposal approved successfully");
      window.location.href = "lender.html";
    } catch (error) {
      console.error("Error approving loan:", error);
      alert("Failed to approve loan proposal");
    }
  },

  rejectLoan: async () => {
    if (!App.contract || !App.account) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      await App.contract.methods
        .rejectProposal(App.param)
        .send({ from: App.account });
      alert("Loan proposal rejected successfully");
      window.location.href = "lender.html";
    } catch (error) {
      console.error("Error rejecting loan:", error);
      alert("Failed to reject loan proposal");
    }
  },

  verifyOwnership: async () => {
    try {
      const proposal = await App.contract.methods.proposals(App.param).call();
      const collateralHash = proposal.collateral;

      // Check if collateral exists in the contract
      const borrower = await App.contract.methods
        .collateralToBorrower(collateralHash)
        .call();

      if (borrower === "0x0000000000000000000000000000000000000000") {
        throw new Error("Collateral not found");
      }

      // Update UI to show verification in progress
      document.getElementById("ownershipStep").classList.add("active");
      document.getElementById("verifyOwnershipBtn").disabled = true;

      // Call the contract to verify ownership
      await App.contract.methods
        .verifyOwnership(App.param)
        .send({ from: App.account });

      alert("Ownership verification successful");
      await App.loadDetails();
    } catch (error) {
      console.error("Error verifying ownership:", error);
      alert("Error verifying ownership: " + error.message);
    }
  },

  verifyValue: async () => {
    try {
      const proposal = await App.contract.methods.proposals(App.param).call();

      // Update UI to show verification in progress
      document.getElementById("valueStep").classList.add("active");
      document.getElementById("verifyValueBtn").disabled = true;

      // Call the contract to verify value
      await App.contract.methods
        .verifyValue(App.param)
        .send({ from: App.account });

      alert("Value verification successful");
      await App.loadDetails();
    } catch (error) {
      console.error("Error verifying value:", error);
      alert("Error verifying value: " + error.message);
    }
  },

  calculateRisk: async () => {
    try {
      // Update UI to show risk calculation in progress
      document.getElementById("riskStep").classList.add("active");
      document.getElementById("calculateRiskBtn").disabled = true;

      // Call the contract to calculate risk
      await App.contract.methods
        .calculateRisk(App.param)
        .send({ from: App.account });

      alert("Risk calculation completed");
      await App.loadDetails();
    } catch (error) {
      console.error("Error calculating risk:", error);
      alert("Error calculating risk: " + error.message);
    }
  },
};

// Helper function to update verification steps
function updateVerificationSteps(state) {
  const steps = [
    document.getElementById("ownershipStep"),
    document.getElementById("valueStep"),
    document.getElementById("riskStep"),
  ];

  steps.forEach((step, index) => {
    if (state > index) {
      step.classList.add("completed");
      step.classList.remove("active");
    } else if (state === index) {
      step.classList.add("active");
      step.classList.remove("completed");
    } else {
      step.classList.remove("active", "completed");
    }
  });
}

// Event Listeners
document.getElementById("approveBtn").addEventListener("click", () => {
  App.approveLoan();
});

document.getElementById("rejectBtn").addEventListener("click", () => {
  App.rejectLoan();
});

document.getElementById("verifyOwnershipBtn").addEventListener("click", () => {
  App.verifyOwnership();
});

document.getElementById("verifyValueBtn").addEventListener("click", () => {
  App.verifyValue();
});

document.getElementById("calculateRiskBtn").addEventListener("click", () => {
  App.calculateRisk();
});

// Initialize the application
$(document).ready(() => {
  App.load();
});
