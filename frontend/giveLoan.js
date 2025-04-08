App = {
  load: async () => {
    await App.loadWeb3();
    await App.loadAccount();
    await App.loadContract();
    await App.submitbtn();
  },

  loadWeb3: async () => {
    if (typeof web3 !== "undefined") {
      App.web3Provider = web3.currentProvider;
      web3 = new Web3(web3.currentProvider);
    } else {
      window.alert("Please connect to Metamask.");
    }
    // Modern dapp browsers...
    if (window.ethereum) {
      window.web3 = new Web3(ethereum);
      try {
        // Request account access if needed
        await ethereum.enable();
      } catch (error) {
        // User denied account access...
      }
    }
    // Legacy dapp browsers...
    else if (window.web3) {
      App.web3Provider = web3.currentProvider;
      window.web3 = new Web3(web3.currentProvider);
    }
    // Non-dapp browsers...
    else {
      console.log(
        "Non-Ethereum browser detected. You should consider trying MetaMask!"
      );
    }
  },
  loadAccount: async () => {
    App.account = (await web3.eth.getAccounts())[0];
    $(".acc").attr("placeholder", App.account);
  },

  loadContract: async () => {
    App.contract = new web3.eth.Contract(abi, address);
  },

  giveLoan: async () => {
    try {
      const amount = document.getElementById("amount").value;
      const time = document.getElementById("time").value;
      const interestRate = document.getElementById("interestRate").value;
      const borrower = App.param;

      if (!amount || !time || !interestRate) {
        alert("Please fill in all fields");
        return;
      }

      // Disable the button during transaction
      const giveLoanBtn = document.getElementById("giveLoanBtn");
      giveLoanBtn.disabled = true;
      giveLoanBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Processing...';

      // Get the specific borrower's proposal
      const proposal = await App.contract.methods.proposals(borrower).call();

      // Call the contract with specific parameters
      await App.contract.methods
        .giveLoan(
          borrower,
          web3.utils.toWei(amount, "ether"),
          time,
          interestRate
        )
        .send({
          from: App.account,
          gas: 300000, // Set a specific gas limit
          gasPrice: web3.utils.toWei("20", "gwei"), // Set a specific gas price
          nonce: await web3.eth.getTransactionCount(App.account), // Use current nonce
        });

      alert("Loan given successfully!");
      window.location.href = "lender.html";
    } catch (error) {
      console.error("Error giving loan:", error);
      alert("Error giving loan: " + error.message);
    } finally {
      // Re-enable the button
      const giveLoanBtn = document.getElementById("giveLoanBtn");
      giveLoanBtn.disabled = false;
      giveLoanBtn.innerHTML =
        '<i class="fas fa-hand-holding-usd"></i> Give Loan';
    }
  },

  submitbtn: async () => {
    $("#submit").on("click", (e) => {
      e.preventDefault();
      App.giveLoan();
    });
  },
};

$(document).ready(() => {
  App.load();
});
