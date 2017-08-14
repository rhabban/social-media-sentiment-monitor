var MongoClient = require('mongodb').MongoClient
  , format = require('util').format;



MongoClient.connect('mongodb://127.0.0.1:27017/SENTIMENT_MONITORING', function(err, db) {
  if(err) throw err;

  showCollections(db);
  showCollection(db);
});

var showCollections = function (db){
  db.listCollections().toArray(function (err, collections) {
    console.log(collections);
    console.log("End of collections");
  });
}

var showCollection = function (db){
  db.collection("collections_request").find().toArray(function (err, collections) {
    for (var i = 0; i < collections.length; i++) {
      var col = collections[i];
      var req = col.requests;
      for (var k = 0; k < req.length; k++) {
        console.log(req[k]);
      }
    }
  });
}
