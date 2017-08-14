var MongoClient = require('mongodb').MongoClient
  , format = require('util').format;

MongoClient.connect('mongodb://127.0.0.1:27017/SENTIMENT_MONITORING', function(err, db) {
  if(err) throw err;

  createCollection(db, "collections_request");
});

var createCollection = function(db, collection_name){
  db.createCollection(collection_name, function (err, collection) {
      if (err) throw err;
  });   
}
