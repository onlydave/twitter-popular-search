var Twitter 	= require('twitter')
   	,_	    	= require('underscore')
	 	,express	=	require('express')
    ,bodyParser = require('body-parser')
		,app			=	express()
    ,mongoose = require("mongoose")
    ,PopularTweetsSchema = require('./schema/popular.tweets.schema').PopularTweets
    ,tweets_holder   = {}
    ,fetch_limit  = 200
    , ptModel = null
    , curteamname = ''
    , curteamindex = 0
    , counttwitterrequests = 0
    , counttweets = 0;
 
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
app.use(bodyParser.json())


var connect = function(){
  mongoose.connect('mongodb://localhost/populartweets/');
  db = mongoose.connection;
  ptModel = mongoose.model("popular_tweets", PopularTweetsSchema);
}

var storeTweets = function(teamname){
  console.log(teamname);
  var countsave = 0;
  _.each(tweets_holder[teamname], function(t){
    ptModel.update({_id : t.id_str}, {
      id_str : t.id_str,
      created_at :  t.created_at,
      date : new Date(t.created_at),
      text  : t.text,
      user_id : t.user.id,
      user_name : t.user.name,
      search_term : teamname
    }, { upsert : true }
    ,function (err) {
      if (err) console.log(err);
      countsave++;
      // console.log("Saved " + t.id_str);
    })
  })
  console.log(counttwitterrequests + ' requests to twitter');
  console.log('total tweets: '+counttweets)
}

var twitter_cridentials = {
  consumer_key: '<insert key here>',
  consumer_secret: '<insert key here>',
  access_token_key: '', //these keys aren't needed for read
  access_token_secret: '' //these keys arent needed for read 
}

if (twitter_cridentials.consumer_key == '<insert key here>'){
  console.log('ERROR:: You need to add your twitter key and secret from https://apps.twitter.com');
  process.exit();
}

var client = new Twitter();

app.use(express.static('views'));

var teams = require('./teamname.js').teams;

// teams = [];

var    filters    = ' filter:safe'
    ,exclusions = ' -filter:retweets -from:WillHillBet -from:paddypower -from:SkyBet';

var params = {};
var setcurteamname = function(teamname){
  console.log('1teammname set to '+teamname)
   params = {
    q: teamname+filters+exclusions,
    lang: 'en',
    result_type: 'popular'
  };
  tweets_holder[teamname] = [];
  curteamname = teamname;
  console.log('teammname set to '+curteamname)
}

setcurteamname(teams[0]);

var setTweets = function(error, _tweets, response){
  if (!error){
    // console.log(_tweets.search_metadata);
    console.log('tweets set '+_tweets.statuses.length + ' : '+curteamname);
    counttweets+=_tweets.statuses.length;
    tweets_holder[curteamname] = tweets_holder[curteamname].concat(_tweets.statuses);
    if (fetch_limit && _tweets.statuses.length == 15){
      var max_id = JSON.parse('{"' + decodeURI(_tweets.search_metadata.next_results).replace(/^\?/, '').replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}').max_id;
      client.get('search/tweets', _.extend(params, {max_id: max_id}), setTweets);
      fetch_limit--;
    } else {
      fetch_limit = 200
      // console.log(_tweets)
      storeTweets(curteamname);
      if (teams[curteamindex+1]){
        curteamindex++;
        setcurteamname(teams[curteamindex]);
        client.get('search/tweets', params, setTweets);
        console.log('team name incrimented to'+teams[curteamindex])
      } else {
        console.log('you have reached the end my friend');
      }
    }
  } else {
    console.log('ERRRROOORRRRRR');
    console.log(error);
  }
  counttwitterrequests++;
};

client.get('search/tweets', params, setTweets);

app.get('/tweets/premierleague', function(req, res) {
  res.send(tweets_holder);
})
app.post('/sendtoken', function(req, res) {
  console.log('hi');
  console.log(req.body);
  res.end();
})
app.get('/tweets/stored', function(req, res) {
  var s = ptModel.find({})
  // .select('search_term')
  .sort([['date', 'descending']])
  .exec(function(e, s){
    res.json(s);
  });
  
})
app.get('/rate', function(req, res) {
  client.get('application/rate_limit_status', params, function(error, status, response){
    if (!error){
      console.log(response)
      res.send(response);
    } else {
      console.log('ERRRROOORRRRRR');
      console.log(error);
      res.send(error);
    }
  });
})

app.listen(1234);
connect();
