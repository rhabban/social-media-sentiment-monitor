var express = require('express');
var exec = require('child_process').exec; // exec OS commands
var spawn = require('child_process').spawn; // exec OS commands
var d3 = require('d3');

var Twitter = require('twitter');
var util = require('util');

// TODO : Insert your twitter key
var client = new Twitter({
    consumer_key: '',
    consumer_secret: '',
    access_token_key: '',
    access_token_secret: ''
});


var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');

var assert = require('assert');

try {
    var config = require('./config.json');
} catch (err) {
    console.log('Impossible de lire le fichier config.json');
    process.exit();
}

//MongoDb
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;
var url = 'mongodb://localhost:27017/SENTIMENT_MONITORING';

//grab 3 last matches
exec('scrapy crawl matches -t json --nolog -o - > "matches.json"', {
    cwd: 'scrapy/sm_matches'
}, function (error, stdout, stderr) {
    matchData = require('./scrapy/sm_matches/matches.json');

});

app.get('/', function (req, res) {
        res.render('index.ejs', {matches: matchData});
    })
    .get('/about', function (req, res) {
        res.render('about.ejs');
    })
    .get('/getTweets', function (req, res) {
        var feelingScore = req.query.score;
        var date = req.query.date;

        var test;

        Tweet.find(function (err, tweets) {
            if (err) return console.error(err);
            test = tweets;
            res.json(test);
        });

    })
    .get('/call_api', function (req, res) {
        res.render('call_api.ejs');
    })
    .get('/call_api', function (req, res) {
        res.render('call_api.ejs');
    })
    .use("/css", express.static(__dirname + "/css"))
    .use("*", function (req, res) {
        res.render("404.ejs");
    })

server.listen(8080);
console.log('Listening at localhost:8080');

io.on('connection', function (socket) {

    var listCollections = [];
    var total_tweets = 0;

    getCollectionName(socket);


    //check if match is in collection
    socket.on('findMatchInCollectionRequest', function (data) {
        findMatchInCollection(socket, data);
    });

    //GET TWEETS FROM COLLECTION NAME
    socket.on('tweetsRequest', function (data) {
        getTweetsFromCollectionName(socket, data);
    });


    try {
        socket.emit("match_dates", getMatchDates(socket));
    } catch (e) {
        console.log(e);
    }

    // Add collection
    socket.on('add_collection_name', function (data) {
        insertCollectionName(data, socket);
    });


    // Send twitter request and save tweets in json ('./out/')
    socket.on('submit_form', function (data) {
        console.log(data);

        var files_path = "out/";

        // Delete all files in 'out'
        fs.readdir(files_path, function (err, files) {
            if (err) {
                throw err;
            }

            files.forEach(function (file) {
                fs.unlink(files_path + file);
            });
        });

        var args = {'q': data.keyword, 'count': data.count, 'until': data.date};

        // Get Match data if found in file matches.json
        var match_data = getMatchDates();
        var date = new Date(data.date);
        var reqDate = new Date();
        reqDate.setDate(date.getDate() - 1);
        str_date = reqDate.getUTCFullYear() + '-' + (reqDate.getUTCMonth() + 1) + '-' + reqDate.getUTCDate();
        var index = match_data.indexOf(str_date);

        if (index >= 0) {
            match_data = getMatchDates(index);
        } else {
            match_data = null;
        }

        updateCollectionRequest(data.collectionName, data.keyword, data.date, match_data);

        var i = 1;
        var i_max = Math.ceil(args.count / 100);
        var missing = args.count % 100;

        function getTweets(args) {
            var req = args;
            if (args.count < 100) {
                req.count = missing;
            } else if (i == i_max && missing != 0)
                req.count = missing;
            else
                req.count = 100;

            console.log(req);

            //Twitter Request
            client.get('search/tweets', req, function (error, tweets, response) {
                tweets = tweets.statuses;
                for (var k = tweets.length; k > req.count; k--) {
                    tweets.pop();
                }

                // Write all tweets in json files
                fs.writeFile('Out/tweets' + i + '.json', JSON.stringify(tweets, null, 2), function (err) {
                    if (err)
                        return console.log(err);
                    total_tweets += tweets.length;
                    var data_emit = {'i': i, 'total_tweets': total_tweets, 'i_max': i_max}
                    if (total_tweets == data.count || tweets.length < req.count) {
                        console.log('total_tweets :' + total_tweets);
                        socket.emit('twitter_request', data_emit);
                        socket.emit('twitter_request_done', total_tweets);
                        return true;
                    } else {
                        var min_id = tweets[tweets.length - 1].id;
                        req.max_id = min_id;

                        socket.emit('twitter_request', data_emit);
                        i++;
                        getTweets(req);
                    }
                });
            });
        }

        getTweets(args);
    });

    // Analyze tweets
    socket.on('start_parsing_tweets', function (collection_name) {
        var sentiment = require('sentiment-french');
        var async = require('async');
        var jf = require('jsonfile');

        var files_path = "out/";

        fs.readdir(files_path, function (err, files) {
            if (err) {
                throw err;
            }

            var file_number = files.length;
            var i_file = 1;
            var i_tweet = 1;

            files.forEach(function (file) {
                var tweets = jf.readFileSync(files_path + file);
                async.each(tweets, function (tweet, callback) {
                    var s = sentiment(tweet.text, {
                      'Défaite': -2,
                      'défaite' :-2
                    });
                    tweet.score = s;
                    MongoClient.connect(url, function (err, db) {
                        assert.equal(null, err);
                        insertTweet(db, tweet, collection_name, function () {
                            db.close();
                            socket.emit('file_parsed', i_tweet, total_tweets, i_tweet);
                            i_tweet++;
                            callback();
                        });
                    });

                }, function (err) {
                    if (err)
                        console.log('A tweet failed to process');
                    else {
                        console.log('All tweet in file ' + i_file + ' have been processed');

                        //socket.emit('file_parsed', i_file, file_number, i_tweet);
                        i_file++;
                        if (i_file > file_number) {
                            socket.emit('end_parsing', total_tweets);
                        }
                    }
                });
            });
        })


    });

});

var insertTweet = function (db, tweet, collection_name, callback) {
    var tweet_to_insert = {};
    tweet_to_insert.id = tweet.id;
    tweet_to_insert.text = tweet.text;
    tweet_to_insert.score = tweet.score;
    tweet_to_insert.date = tweet.created_at;
    client.get('statuses/oembed', {id: tweet.id_str}, function (err, tweet, response) {
        if (err) {
            err.id_tweet = tweet_to_insert.id;
            console.log(err);
        }
        else {
            tweet_to_insert.url = tweet.url;
            tweet_to_insert.author_name = tweet.author_name;
            tweet_to_insert.author_url = tweet.author_url;
            tweet_to_insert.html = tweet.html;
            tweet_to_insert.width = tweet.width;
            tweet_to_insert.height = tweet.height;
        }
        db.collection(collection_name).insertOne(tweet_to_insert, function (err, result) {
            assert.equal(err, null);
            callback();
        });
    })
};

var getCollectionName = function (socket) {
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        //db.listCollections().toArray(function (err, collections) {
        db.collection("collections_request").find().toArray(function (err, collections) {
            socket.emit('collectionNames', collections);
        });
    });
};

var insertCollectionName = function (collection_name, socket) {
    MongoClient.connect(url, function (err, db) {
        db.collection("collections_request").insert({"name": collection_name, "requests": []});
        db.createCollection(collection_name, function (err, collection) {
            if (err) throw err;
            console.log("Collection " + collection_name + " created");
            getCollectionName(socket);
        });
    });
}

var updateCollectionRequest = function (collection_name, keyword, date, match_data) {
    MongoClient.connect(url, function (err, db) {
        db.collection('collections_request').findAndModify(
            {name: collection_name}, // query
            [['_id', 'asc']],  // sort order
            {
                $addToSet: {requests: {"keyword": keyword, "date": date, "match_data": match_data}}
            }, // replacement, replaces only the field keywords
            {}, // options
            function (err, object) {
                if (err) {
                    console.warn(err.message);  // returns error if no matching object found
                } else {
                    console.dir(object);
                }
            });
    });
}

var getMatch = function () {
    matchData = require('./scrapy/sm_matches/matches.json');
    return matchData;
}

var getMatchDates = function (index) {
    matchData = getMatch();
    var dates = [];
    for (var i = 0; i < matchData.length; i++) {
        var data = matchData[i].date.split(" ")[0];
        var date_splited = data.split("/");

        var date = new Date("20" + date_splited[2], date_splited[0], date_splited[1]);
        dates.push(date.getUTCFullYear() + '-' + date.getUTCMonth() + '-' + (date.getUTCDate() + 1));
        if (index == i) {
            return matchData[i];
        }
    }
    return dates;
}


var getTweetsFromCollectionName = function (socket, collectionName) {
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        db.collection(collectionName).find().toArray(function (err, tweets) {
            socket.emit('tweetsFromCollectionName', tweets);
        });
    });
}


var findMatchInCollection = function (socket, name)
{
    MongoClient.connect(url, function (err, db)
    {
        assert.equal(null, err);

        db.collection("collections_request").findOne({name:name}, function(err, collection)
        {
            matchesDates = getMatchDates();
            for (var i = 0; i < matchesDates.length; i++)
            {
                for (var j = 0; j < collection.requests.length; j++)
                {
                    if(matchesDates[i] == collection.requests[j])
                    {
                        socket.emit('findMatchInCollectionResponse', "The match of the : " + matchesDates[i] + " is in this collection");
                        break;
                    }

                    else {
                        socket.emit('findMatchInCollectionResponse', "No matches available in this collection");
                        break;
                    }
                }
            }
        });
    });
};
