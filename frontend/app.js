const LoanState = {
  0: "REPAID",
  1: "ACCEPTED",
  2: "WAITING",
  3: "PAID",
  4: "FAILED",
};

App = {
  crypt: "",

  load: async () => {
    await App.loadWeb3();
    await App.loadAccount();
    await App.loadContract();
    await App.loadLenders();
    await App.render();
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
    const accounts = await web3.eth.getAccounts();
    // For borrower page, use the first account
    if (window.location.pathname.includes("borrower.html")) {
      App.account = accounts[0];
    }
    // For lender page, use the second account
    else if (window.location.pathname.includes("lender.html")) {
      App.account = accounts[1];
    }
    // Default to first account
    else {
      App.account = accounts[0];
    }
    $("#acc").attr("placeholder", App.account);
  },

  loadContract: async () => {
    App.contract = new web3.eth.Contract(abi, address);
  },

  render: async () => {
    $("#submit").on("click", (e) => {
      e.preventDefault();
      App.createProposal();
    });

    // Handle collateral type selection
    $("#collateralType").on("change", function () {
      const selectedType = $(this).val();
      const mortgageContainer = $("#mortgage-input-container");

      if (selectedType) {
        mortgageContainer.show();
        $("#mortgage").attr("placeholder", `Enter ${selectedType} Address`);
      } else {
        mortgageContainer.hide();
      }
    });
  },

  createProposal: async () => {
    const time = new Date($(".date").val()).getTime() / 1000;
    const mortgage = $("#mortgage").val();
    const amount = $(".amount").val();
    const collateralType = $("#collateralType").val();

    if (!collateralType) {
      alert("Please select a collateral type");
      return;
    }

    if (!mortgage) {
      alert("Please enter and verify the collateral address");
      return;
    }

    await App.contract.methods
      .createProposal(amount, time, mortgage, collateralType)
      .send({ from: App.account });
  },

  loadLenders: async () => {
    const all_potential_lenders = await App.contract.methods
      .getAllPotentialLenders()
      .call();

    all_potential_lenders.forEach(async (lender) => {
      const borrower = await App.contract.methods
        .proposalToBorrower(lender.proposalId)
        .call();

      let payB = 0;
      let repayB = 0;

      console.log("state", lender.state);

      // if(lender.state == '1'){
      //   payB = 1;
      // }
      // else if(lender.state == '3' || lender.state == '2'){
      //   repayB = 1;
      // }
      // else
      // {
      //   payB = 1;
      //   repayB = 1;
      // }

      if (lender.state == "3") {
        payB = 1;
      } else if (lender.state == "1" || lender.state == "2") {
        repayB = 1;
      } else {
        payB = 1;
        repayB = 1;
      }

      if (borrower == App.account) {
        $(".table").append(`<tr>
        <td data-label="Lender Address">
          ${lender.lender}
        </td>
        <td data-label="Amount">${lender.loanAmount}</td> 
        <td data-label="Interest">${lender.interestRate}</td>
        <td data-label="">
        <a href="#"><button id=${
          lender.loanId
        } class="btn btn__active p" onClick=App.getLoan()>Get Loan</button></a>
        </td>
        <td data-label="">
        <a href="#"><button id=${lender.loanId} onClick= App.repay(${
          lender.loanId
        }) class="btn btn__active r")>Repay</button></a>
        </td>
        <td data-label="Status">${LoanState[lender.state]}</td>
        </tr>
       `);
      }

      if (payB == 1) {
        $(".p").attr("disabled", true);
      }
      if (repayB == 1) {
        $(".r").attr("disabled", true);
      }
    });
  },

  getLoan: async () => {
    console.log("loan");

    const loans = await App.contract.methods.getAllPotentialLenders().call();

    loans.forEach(async (loan) => {
      const lender = loan.lender;
      const loanAmount = loan.loanAmount;

      console.log(loanAmount);

      const receipt = await App.contract.methods
        .acceptLender(loan.loanId, loan.proposalId)
        .send({ from: App.account });
      console.log(receipt);
      const ab = await App.contract.methods.getAllLoans().call();
      console.log(ab);
    });
  },

  // getLoan : async (id) => {
  //   let o;
  //   const all_potential_lenders = await App.contract.methods.getAllPotentialLenders().call();
  //   all_potential_lenders.forEach(async lender => {
  //     if(lender.loanId == id){
  //       o = lender.proposalId;

  //       let a= await App.contract.methods.acceptLender(id,Number(o)).send({from: App.account});
  // console.log(a);
  //  const ab = await App.contract.methods.getAllLoans().call();
  //  console.log(ab);
  //     }})

  //   },

  repay: async (id) => {
    const all_potential_lenders = await App.contract.methods
      .getAllPotentialLenders()
      .call();
    all_potential_lenders.forEach(async (lender) => {
      if (lender.loanId == id) {
        await App.contract.methods
          .loanPaid(lender.loanId)
          .send({ from: App.account });

        let final = 0;
        const time = Date.now() - lender.time;
        const rate = lender.interestRate;
        const principal = lender.loanAmount;
        console.log(time);
        console.log(lender.time);
        final = (principal * rate * time) / 100365246060;
        let val = "";
        val += final;
        await web3.eth
          .sendTransaction({
            from: App.account,
            to: lender.lender,
            value: web3.utils.toWei(val, "ether"),
          })
          .then(async function (receipt) {
            console.log(receipt);
            App.bool = false;
          });
      }
    });
  },
};

$(document).ready(() => {
  App.load();
});

async function verifyMortgage() {
  const mortgageAddress = document.getElementById("mortgage").value;
  const collateralType = document.getElementById("collateralType").value;
  const container = document.getElementById("mortgage-verification-container");

  if (!mortgageAddress) {
    alert("Please enter a collateral address");
    return;
  }

  if (!collateralType) {
    alert("Please select a collateral type first");
    return;
  }

  // Show the container
  container.style.display = "block";

  try {
    let contract;
    let verificationResult;

    switch (collateralType) {
      case "property":
        contract = new web3.eth.Contract(propertyABI, mortgageAddress);
        verificationResult = await verifyProperty(contract);
        break;
      case "nft":
        contract = new web3.eth.Contract(nftABI, mortgageAddress);
        verificationResult = await verifyNFT(contract);
        break;
      case "token":
        contract = new web3.eth.Contract(tokenABI, mortgageAddress);
        verificationResult = await verifyToken(contract);
        break;
      default:
        throw new Error("Unsupported collateral type");
    }

    displayVerificationResults(verificationResult);
  } catch (error) {
    console.error("Error verifying collateral:", error);
    container.innerHTML = `
      <div class="alert alert-danger">
        Error verifying collateral. Please make sure you entered a valid address and selected the correct type.
      </div>
    `;
  }
}

async function verifyProperty(contract) {
  const [propertyDetails, owner, value, isVerified, additionalInfo] =
    await Promise.all([
      contract.methods.getPropertyDetails().call(),
      contract.methods.owner().call(),
      contract.methods.getPropertyValue().call(),
      contract.methods.isVerified().call(),
      contract.methods.getAdditionalInfo().call(),
    ]);

  return {
    type: "property",
    details: propertyDetails,
    owner,
    value,
    isVerified,
    additionalInfo,
  };
}

async function verifyNFT(contract) {
  const [owner, tokenURI, isVerified] = await Promise.all([
    contract.methods.ownerOf(1).call(),
    contract.methods.tokenURI(1).call(),
    contract.methods.isVerified().call(),
  ]);

  return {
    type: "nft",
    owner,
    tokenURI,
    isVerified,
  };
}

async function verifyToken(contract) {
  const [balance, owner, isVerified] = await Promise.all([
    contract.methods.balanceOf(App.account).call(),
    contract.methods.owner().call(),
    contract.methods.isVerified().call(),
  ]);

  return {
    type: "token",
    balance,
    owner,
    isVerified,
  };
}

function displayVerificationResults(result) {
  const container = document.getElementById("mortgage-verification-container");

  switch (result.type) {
    case "property":
      document.getElementById("property-details").innerHTML = `
        <strong>Address:</strong> ${result.details.propertyAddress}<br>
        <strong>Type:</strong> ${result.details.propertyType}<br>
        <strong>Size:</strong> ${result.details.size} sq ft
      `;
      document.getElementById("ownership-status").innerHTML = `
        <strong>Owner:</strong> ${result.owner}<br>
        <strong>Status:</strong> ${
          result.owner.toLowerCase() === App.account.toLowerCase()
            ? '<span class="text-success">Verified Owner</span>'
            : '<span class="text-danger">Not Owner</span>'
        }
      `;
      document.getElementById("property-value").innerHTML = `
        <strong>Current Value:</strong> ${web3.utils.fromWei(
          result.value,
          "ether"
        )} ETH
      `;
      document.getElementById("verification-status").innerHTML = `
        <strong>Status:</strong> ${
          result.isVerified
            ? '<span class="text-success">Verified</span>'
            : '<span class="text-warning">Pending Verification</span>'
        }
      `;
      document.getElementById("additional-info").innerHTML = `
        <strong>Last Appraisal:</strong> ${new Date(
          result.additionalInfo.lastAppraisal * 1000
        ).toLocaleDateString()}<br>
        <strong>Liens:</strong> ${
          result.additionalInfo.hasLiens ? "Yes" : "No"
        }<br>
        <strong>Insurance Status:</strong> ${
          result.additionalInfo.isInsured ? "Insured" : "Not Insured"
        }
      `;
      break;

    case "nft":
      document.getElementById("property-details").innerHTML = `
        <strong>Token URI:</strong> ${result.tokenURI}<br>
        <strong>Type:</strong> NFT
      `;
      document.getElementById("ownership-status").innerHTML = `
        <strong>Owner:</strong> ${result.owner}<br>
        <strong>Status:</strong> ${
          result.owner.toLowerCase() === App.account.toLowerCase()
            ? '<span class="text-success">Verified Owner</span>'
            : '<span class="text-danger">Not Owner</span>'
        }
      `;
      document.getElementById("verification-status").innerHTML = `
        <strong>Status:</strong> ${
          result.isVerified
            ? '<span class="text-success">Verified</span>'
            : '<span class="text-warning">Pending Verification</span>'
        }
      `;
      break;

    case "token":
      document.getElementById("property-details").innerHTML = `
        <strong>Balance:</strong> ${web3.utils.fromWei(
          result.balance,
          "ether"
        )} tokens<br>
        <strong>Type:</strong> Token
      `;
      document.getElementById("ownership-status").innerHTML = `
        <strong>Owner:</strong> ${result.owner}<br>
        <strong>Status:</strong> ${
          result.owner.toLowerCase() === App.account.toLowerCase()
            ? '<span class="text-success">Verified Owner</span>'
            : '<span class="text-danger">Not Owner</span>'
        }
      `;
      document.getElementById("verification-status").innerHTML = `
        <strong>Status:</strong> ${
          result.isVerified
            ? '<span class="text-success">Verified</span>'
            : '<span class="text-warning">Pending Verification</span>'
        }
      `;
      break;
  }
}
