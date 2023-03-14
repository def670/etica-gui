// In renderer process (web page).
const {ipcRenderer} = require("electron");

// Set the provider you want from Web3.providers
SyncProgress = new ProgressBar.Line("#syncProgress", {
  strokeWidth: 6,
  easing: "easeInOut",
  duration: 1400,
  color: "#308968",
  trailColor: "#eee",
  trailWidth: 1,
  text: {
    style: {
      color: "#bbb",
      position: "absolute",
      left: "50%",
      top: "-1px",
      transform: "translateX(-50%)",
      fontSize: "0.9em",
      LineHeight: "24px",
      padding: 0
    },
    autoStyleContainer: false
  },
  from: {
    color: "#FFEA82"
  },
  to: {
    color: "#ED6A5A"
  }
});

// set initial value for the progress text
SyncProgress.setText("Connecting to peers, please wait...");
isFullySynced = false;

initWeb3Passed =false;
alreadyCatchedUp = false;
auto_unlock_done = false;


var peerCountInterval = setInterval(function () {
  web3Local.eth.net.getPeerCount(function (error, count) {
    $("#peerCount").html(vsprintf("Peer Count: %d", [count]));
  });
}, 5000);

function StartSyncProcess() {
  //var alreadyCatchedUp = false;
  var nodeSyncInterval = null;
  var SyncBalancesInterval = null;
  console.log('inside StartSyncProcess');

  var subscription = web3Local.eth.subscribe("syncing", function (error, sync) {
    console.log('inside StartSyncProcess syncing subscription');
    if (!error) {
      console.log('inside StartSyncProcess syncing subscription no error sync is', sync);
      if (!sync) {
        console.log('inside StartSyncProcess syncing subscription no error, not synced');
        SyncProgress.setText("Syncing blockchain, please wait...");
        if (nodeSyncInterval) {
          console.log('inside clearInterval(nodeSyncInterval)');
          clearInterval(nodeSyncInterval);
        }

        nodeSyncInterval = setInterval(function () {
          console.log('inside nodeSyncInterval');
          web3Local.eth.getBlock("latest", function (error, localBlock) {
            //console.log('local block number is', localBlock.number);
            if (!error) {
              if (localBlock.number > 0) {
                console.log('local block number > 0 is', localBlock.number);
                if (!EticaTransactions.getIsSyncing()) {
                  SyncProgress.animate(1);
                  SyncProgress.setText(vsprintf("%d/%d (100%%)", [localBlock.number, localBlock.number]));
                }

                if (alreadyCatchedUp == false) {
                  // clear the repeat interval and render wallets
                  $(document).trigger("onNewAccountTransaction");
                  alreadyCatchedUp = true;
                  isFullySynced = true;

                  // enable the keep in sync feature
                  EticaTransactions.enableKeepInSync();

                  // sync all the transactions to the current block
                  let maincounter = ipcRenderer.sendSync("getCounter", "MainCounter");
                  console.log('maincounter is', maincounter);
                  if(maincounter && maincounter.block){
                    EticaTransactions.ScanTxs(maincounter, localBlock.number, 500);
                  }
                  else {
                    let newcounter = {};
                    newcounter.name = "MainCounter";
                    newcounter.block = 0;
                    ipcRenderer.send("createCounter", newcounter);
                    EticaTransactions.ScanTxs(newcounter, localBlock.number, 500);
                  }
                  
                }
              }
            } else {
              EticaMainGUI.showGeneralError(error);
              InitializeWeb3();
            }
          });
        }, 5000);
      }
    } else {
      EticaMainGUI.showGeneralError(error);
    }
  }).on("data", function (sync) {
    if (sync && sync.HighestBlock > 0) {
      SyncProgress.animate(sync.CurrentBlock / sync.HighestBlock);
      SyncProgress.setText(vsprintf("%d/%d (%d%%)", [
        sync.CurrentBlock,
        sync.HighestBlock,
        Math.floor(sync.CurrentBlock / sync.HighestBlock * 100)
      ]));
    }
  }).on("changed", function (isSyncing) {
    if (isSyncing) {
      nodeSyncInterval = setInterval(function () {
        web3Local.eth.isSyncing(function (error, sync) {
          if (!error && sync) {
            SyncProgress.animate(sync.currentBlock / sync.highestBlock);
            SyncProgress.setText(vsprintf("%d/%d (%d%%)", [
              sync.currentBlock,
              sync.highestBlock,
              Math.floor(sync.currentBlock / sync.highestBlock * 100)
            ]));
          } else if (error) {
            EticaMainGUI.showGeneralError(error);
            InitializeWeb3();
          }
        });
      }, 2000);
    } else {
      if (nodeSyncInterval) {
        clearInterval(nodeSyncInterval);
      }
    }
  });
  

  /*

  console.log('set EticaTransactions.setIsSyncing to false');
  EticaTransactions.setIsSyncing(false);
  // enable the keep in sync feature
  EticaTransactions.enableKeepInSync();
  console.log('set EticaTransactions.setIsSyncing to false');

  */
  
}


function autounlockWallet() {

// Only once:
if(!auto_unlock_done){

  auto_unlock_done = true;
  // unlock accounts
  let _temppw = ipcRenderer.sendSync("getTempPw");
  let _wallet = ipcRenderer.sendSync("getRunningWallet");
  
  if(_wallet.autounlock){
  
    web3Local.eth.getAccounts(async function (err, res) {
      if (err) {
        clbError(err);
      } else {
        for (var w = 0; w < res.length; w++) {
          const account = res[w];
          await web3Local.eth.personal.unlockAccount(account, _temppw, _wallet.unlocktime, async function (error, result) { 
            if (error) {
              console.log("error autounlocking account!", error);
              return false;
            }
            //console.log('account:', account);
            //console.log('result is', result);
            let isunlocked = await EticaBlockchain.isUnlocked(account);
            //console.log('isunlocked', isunlocked);
          });
        }
      }
    });
  
  }
}

}

function setEticaContractAddress() {

    // get running wallet:
    let _wallet = ipcRenderer.sendSync("getRunningWallet");
    
    if(_wallet.contractaddress){
    
      let etica_contract = EticaContract.getEticaContractAddress();
      let etica_blockchain = EticaBlockchain.getEticaContractAddress();
      if(etica_contract != _wallet.contractaddress){
        EticaContract.setEticaContractAddress(_wallet);
      }
      if(etica_blockchain != _wallet.contractaddress){
        EticaBlockchain.setEticaContractAddress(_wallet);
      }
    
    }
    // should never happen:
    else {
      EticaMainGUI.showGeneralError('Error, no smart contract address provided');
    }

  }

var RetrySuscribeSyncing = setInterval( function () {
  try {
    console.log('Inside RetrySuscribeSyncing');
    if(initWeb3Passed){
    if(alreadyCatchedUp == false){

      web3Local.eth.isSyncing(function (error, sync) {
        if (!error && sync) {    
           // do nothing syncing ok in progress  
          // console.log('RetrySuscribeSyncing do nothing case I');
        } else if (!sync){
         // console.log('RetrySuscribeSyncing call StartSyncProcess() case II');
          StartSyncProcess(); 
        }    
        else if (error) {
         // console.log('error', error);
         // console.log('RetrySuscribeSyncing call error case III');
          InitializeWeb3();
        }
      });

    }
    else{
      console.log('clearInterval RetrySuscribeSyncing');
      clearInterval(RetrySuscribeSyncing);
    }
  }
  } catch (err) {
    EticaMainGUI.showGeneralError(err);
  }
}, 10000);


function InitializeWeb3() {
var InitWeb3 = setInterval(async function () {
  try {
   /* var options = {
      reconnect: {
          auto: true,
          delay: 2000, // ms
          maxAttempts: 5, // 120 -> 10 minutes (1 every 5 seconds)
          onTimeout: false
      }
  }; */
    //let _provider = new Web3.providers.WebsocketProvider("ws://localhost:8551", options);
    let _provider = new Web3.providers.WebsocketProvider("ws://localhost:8551");
    

    web3Local = new Web3(_provider);
    
    /*_provider.on('error', () => {
      console.log('providerr error');
      _provider.disconnect();
      //web3.currentProvider.connection.close();
      //web3Local.setProvider(newProvider())
    });
    _provider.on('close', () => {
      console.log('provider close');
    }); */

    console.log('inside InitWeb3');
    web3Local.eth.net.isListening(function (error, success) {
      if (!error) {
        console.log('inside InitWeb3 no error passed');
        $(document).trigger("onGethReady");
        initWeb3Passed = true; 
        console.log('initWeb3Passed is now: ', initWeb3Passed);
        clearInterval(InitWeb3);
        StartSyncProcess();
        setEticaContractAddress();
        autounlockWallet();
      }
    });
  } catch (err) {
    EticaMainGUI.showGeneralError(err);
  }
}, 2000);

}

InitializeWeb3();