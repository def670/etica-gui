// In renderer process (web page).
const {ipcRenderer} = require("electron");

class StakesBoard {
  constructor() {
    this.filter = "";
    this.isLoading = false;
  }

  setIsLoading(value) {
    this.isLoading = value;
  }

  getIsLoading() {
    return this.isLoading;
  }

  setFilter(text) {
    this.filter = text;
  }

  getFilter() {
    return this.filter;
  }

  clearFilter() {
    this.filter = "";
  }

  renderStakesBoard(SearchedAddress=null) {

    console.log('SearchedAddress is', SearchedAddress);

    BoardStakes.setFilter(SearchedAddress);



    EticaBlockchain.getAccountsData(function (error) {
      EticaMainGUI.showGeneralError(error);
    }, async function (walletdata) {

      console.log('walletdata is', walletdata);

      let data = await EticaContract.getStakesBoardBalancesofAddress(SearchedAddress);

      console.log('data before is', data);
      data.sumBalance = walletdata.sumBalance; // wallet egaz balance
      data.sumBalanceEti = walletdata.sumBalanceEti; // wallet eti balance
      console.log('data after is', data);

      if( SearchedAddress != null){
        let _stakesresult = await BoardStakes.SearchInput(SearchedAddress);
        data.stakes = _stakesresult.stakes;
        data.stakescounter = _stakesresult.stakescounter;
      }
      else {
        // please provide an address, with select options
      }

      console.log('data final to stakesboard is', data);
      EticaMainGUI.renderTemplate("stakesboard.html", data);
      $(document).trigger("render_stakesboard");

    });

  }

  validateSendForm() {
    if (EticaMainGUI.getAppState() == "send") {
      if (!$("#sendFromAddress").val()) {
        EticaMainGUI.showGeneralError("Sender address must be specified!");
        return false;
      }

      if (!EticaBlockchain.isAddress($("#sendFromAddress").val())) {
        EticaMainGUI.showGeneralError("Sender address must be a valid address!");
        return false;
      }

      if (!$("#sendToAddress").val()) {
        EticaMainGUI.showGeneralError("Recipient address must be specified!");
        return false;
      }

      if (!EticaBlockchain.isAddress($("#sendToAddress").val())) {
        EticaMainGUI.showGeneralError("Recipient address must be a valid address!");
        return false;
      }

      if (Number($("#sendAmmount").val()) <= 0) {
        EticaMainGUI.showGeneralError("Send ammount must be greater then zero!");
        return false;
      }

      return true;
    } else {
      return false;
    }
  }

  resetSendForm() {
    if (EticaMainGUI.getAppState() == "send") {
      $("#sendToAddressName").html("");
      $("#sendToAddress").val("");
      $("#sendAmmount").val(0);
    }
  }


  async SearchInput(_searchedaddress) {
    
    let _result = [];

        console.log('_searchedaddress is', _searchedaddress);
      
        let address_stakes = await EticaContract.getStakesofAddress(_searchedaddress);
        console.log('stakes of Address is', address_stakes);
              
        // if stakes:
        if( address_stakes && address_stakes.stakescounter > 0){

               let stakes = address_stakes.stakes;

               for(let i=0;i < address_stakes.stakes.length;i++){

                stakes[i].amount = parseFloat(web3Local.utils.fromWei(address_stakes.stakes[i].amount, "ether"));
               stakes[i].endTime = moment.unix(parseInt(address_stakes.stakes[i].endTime)).format("YYYY-MM-DD HH:mm:ss");
               stakes[i].available = BoardStakes.getavailability(address_stakes.stakes[i].endTime);
               stakes[i].stakeaddress = _searchedaddress;
               stakes[i].stakeindex = i;

               }

        _result['stakes'] = stakes;
        _result['stakescounter'] = address_stakes.stakescounter;

          }

        return _result;

  }

  // get stakeavailability:
  getavailability(_stakeend){
    let _now = new moment();
    if(_now.isAfter(moment(_stakeend).format("YYYY-MM-DD HH:mm:ss"))){
      return true;
    }
    else{
      return false;
    }
   }

}

$(document).on("render_stakesboard", function () {

  $("#inputStakesBoard").val(BoardStakes.getFilter());

 /* $("#btnStakesBoard").off("click").on("click", async function () {
  
    console.log("$('#inputStakesBoard').val() is:", $('#inputStakesBoard').val());
    BoardStakes.setFilter($('#inputStakesBoard').val());
    return await BoardStakes.SearchInput($('#inputStakesBoard').val());

  }); */

  $("#btnStakesBoard").off("click").on("click", function () {
    EticaMainGUI.changeAppState("stakesBoard");
    BoardStakes.renderStakesBoard($('#inputStakesBoard').val());
  });

  $(".copyClipboard").off("click").on("click", function () {
    EticaMainGUI.copyToClipboard($(this).html());

    iziToast.success({title: "Copied", message: "Content was copied to clipboard", position: "topRight", timeout: 2000});
  });

  $(".btnClaimStake").off("click").on("click", function () {
    var stakeindex = $(this).attr("data-stakeindex");
    var stakeaddress = $(this).attr("data-stakeaddress");
    var stakeamount = $(this).attr("data-stakeamount");

                  EticaContract.getTranasctionFee_stakeclmidx(stakeaddress, stakeindex, function (error) {
                    EticaMainGUI.showGeneralError(error);
                  }, function (data) {
                    $("#dlgClaimStakeWalletPassword").iziModal({width: "70%"});
                    $("#ClaimStakewalletPassword").val("");
                    $("#fromClaimStakeAddressInfo").html(stakeaddress);
                    $("#valueOfClaimStakeIndex").html(stakeindex);
                    $("#valueOfClaimStakeAmount").html(stakeamount);
                    $("#feeClaimStakeToPayInfo").html(parseFloat(web3Local.utils.fromWei(data.toString(), "ether")));
                    $("#dlgClaimStakeWalletPassword").iziModal("open");

            
                    function doSendTransaction() {
                      $("#dlgClaimStakeWalletPassword").iziModal("close");
                      EticaContract.prepareTransaction_stakeclmidx($("#ClaimStakewalletPassword").val(), stakeaddress, stakeindex, function (error) {
                        EticaMainGUI.showGeneralError(error);
                      }, function (data) {
                        EticaBlockchain.sendTransaction(data.raw, function (error) {
                          EticaMainGUI.showGeneralError(error);
                        }, function (data) {
                          EticaCommitHistory.resetClaimForm();
            
                          iziToast.success({title: "Sent", message: "Transaction was successfully sent to the chain", position: "topRight", timeout: 5000});              
                        
                        });
                      });
                    }
            
                    $("#btnClaimStakeWalletPasswordConfirm").off("click").on("click", function () {
                      doSendTransaction();
                    });
            
                    $("#dlgClaimStakeWalletPassword").off("keypress").on("keypress", function (e) {
                      if (e.which == 13) {
                        doSendTransaction();
                      }
                    });
                  });

  });


  $(".btnSnapStake").off("click").on("click", function () {
    var stakeindex = $(this).attr("data-stakeindex");
    var stakeaddress = $(this).attr("data-stakeaddress");
    var stakeamount = $(this).attr("data-stakeamount");

                  EticaContract.getTranasctionFee_stakesnap(stakeaddress, stakeindex, stakeamount, function (error) {
                    EticaMainGUI.showGeneralError(error);
                  }, function (data) {
                    $("#dlgSnapStakeWalletPassword").iziModal({width: "70%"});
                    $("#SnapStakewalletPassword").val("");
                    $("#fromSnapStakeAddressInfo").html(stakeaddress);
                    $("#valueOfSnapStakeIndex").html(stakeindex);
                    $("#valueOfSnapStakeAmount").html(stakeamount);
                    $("#feeSnapStakeToPayInfo").html(parseFloat(web3Local.utils.fromWei(data.toString(), "ether")));
                    $("#dlgSnapStakeWalletPassword").iziModal("open");

            
                    function doSendTransaction() {
                      $("#dlgSnapStakeWalletPassword").iziModal("close");
                      EticaContract.prepareTransaction_stakesnap($("#SnapStakewalletPassword").val(), stakeaddress, stakeindex, stakeamount, function (error) {
                        EticaMainGUI.showGeneralError(error);
                      }, function (data) {
                        EticaBlockchain.sendTransaction(data.raw, function (error) {
                          EticaMainGUI.showGeneralError(error);
                        }, function (data) {
                          EticaCommitHistory.resetClaimForm();
            
                          iziToast.success({title: "Sent", message: "Transaction was successfully sent to the chain", position: "topRight", timeout: 5000});              
                        
                        });
                      });
                    }
            
                    $("#btnSnapStakeWalletPasswordConfirm").off("click").on("click", function () {
                      doSendTransaction();
                    });
            
                    $("#dlgSnapStakeWalletPassword").off("keypress").on("keypress", function (e) {
                      if (e.which == 13) {
                        doSendTransaction();
                      }
                    });
                  });

  });


  $(".btnConsolidateStakes").off("click").on("click", function () {
    var stakeaddress = $(this).attr("data-stakeaddress");

                  EticaContract.getTranasctionFee_stakescsldt(stakeaddress, stakeindex, stakeamount, function (error) {
                    EticaMainGUI.showGeneralError(error);
                  }, function (data) {
                    $("#dlgConsolidateStakesWalletPassword").iziModal({width: "70%"});
                    $("#ConsolidateStakeswalletPassword").val("");
                    $("#fromConsolidateStakesAddressInfo").html(stakeaddress);
                    $("#feeConsolidateStakesToPayInfo").html(parseFloat(web3Local.utils.fromWei(data.toString(), "ether")));
                    $("#dlgConsolidateStakesWalletPassword").iziModal("open");

            
                    function doSendTransaction() {
                      $("#dlgConsolidateStakesWalletPassword").iziModal("close");
                      EticaContract.prepareTransaction_stakescsldt($("#ConsolidateStakeswalletPassword").val(), stakeaddress, function (error) {
                        EticaMainGUI.showGeneralError(error);
                      }, function (data) {
                        EticaBlockchain.sendTransaction(data.raw, function (error) {
                          EticaMainGUI.showGeneralError(error);
                        }, function (data) {
                          EticaCommitHistory.resetClaimForm();
            
                          iziToast.success({title: "Sent", message: "Transaction was successfully sent to the chain", position: "topRight", timeout: 5000});              
                        
                        });
                      });
                    }
            
                    $("#btnConsolidateStakesWalletPasswordConfirm").off("click").on("click", function () {
                      doSendTransaction();
                    });
            
                    $("#dlgConsolidateStakesWalletPassword").off("keypress").on("keypress", function (e) {
                      if (e.which == 13) {
                        doSendTransaction();
                      }
                    });
                  });

  });

});

// create new StakesBoard:
BoardStakes = new StakesBoard();