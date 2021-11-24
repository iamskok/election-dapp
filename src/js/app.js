const DEFAULT_WEB3_PROVIDER = "http://localhost:7545";

const App = {
  web3Provider: null,
  contracts: {},
  account: "0x0",

  init: () => App.initWeb3(),

  initWeb3: async () => {
    if (typeof ethereum !== "undefined") {
      await ethereum.enable();
      // If a web3 instance is already provided by Meta Mask.
      App.web3Provider = ethereum;
      web3 = new Web3(ethereum);
      console.log("ethereum", web3);
    } else {
      // Specify default instance if no web3 instance provided
      App.web3Provider = new Web3.providers.HttpProvider(DEFAULT_WEB3_PROVIDER);
      web3 = new Web3(App.web3Provider);
    }

    return App.initContract();
  },

  initContract: () => {
    $.getJSON("Election.json", (election) => {
      App.contracts.Election = TruffleContract(election);
      App.contracts.Election.setProvider(App.web3Provider);
      App.listenForEvents();

      return App.render();
    });
  },

  render: () => {
    let electionInstance;
    const loader = $("#loader");
    const content = $("#content");

    loader.show();
    content.hide();

    // Load account data
    web3.eth.getCoinbase((err, account) => {
      if (err === null) {
        App.account = account;
        $("#accountAddress").html("Your Account: " + account);
      }
    });

    // Load contract data
    App.contracts.Election.deployed().then((instance) => {
      electionInstance = instance;
      return electionInstance.candidatesCount();
    }).then((candidatesCount) => {
      const candidatesResults = $("#candidatesResults");
      candidatesResults.empty();

      const candidatesSelect = $('#candidatesSelect');
      candidatesSelect.empty();

      for (let i = 1; i <= candidatesCount; i++) {
        electionInstance.candidates(i).then((candidate) => {
          const id = candidate[0];
          const name = candidate[1];
          const voteCount = candidate[2];

          // Render candidate Result
          const candidateTemplate = "<tr><th>" + id + "</th><td>" + name + "</td><td>" + voteCount + "</td></tr>"
          candidatesResults.append(candidateTemplate);

          // Render candidate ballot option
          const candidateOption = "<option value='" + id + "' >" + name + "</ option>"
          candidatesSelect.append(candidateOption);
        });
      }
      return electionInstance.voters(App.account);
    }).then((hasVoted) => {
      // Do not allow a user to vote
      if(hasVoted) {
        $('form').hide();
      }
      loader.hide();
      content.show();
    }).catch((error) => {
      console.warn(error);
    });
  },

  castVote: () => {
    const candidateId = $('#candidatesSelect').val();

    App.contracts.Election.deployed().then((instance) => {
      return instance.vote(candidateId, { from: App.account });
    }).then((result) => {
      // Wait for votes to update
      $("#content").hide();
      $("#loader").show();
    }).catch((err) => console.error(err));
  },

  listenForEvents: () => {
    App.contracts.Election.deployed().then((instance) => {
      instance.Vote({}, {
        fromBlock: 0,
        toBlock: 'latest'
      }).watch((error, event) => {
        console.log("event triggered", event)
        // Reload when a new vote is recorded
        App.render();
      });
    });
  }
};

$(() => $(window).load(() => App.init()));
