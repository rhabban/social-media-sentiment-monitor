var MongoClient = require('mongodb').MongoClient
  , format = require('util').format;



MongoClient.connect('mongodb://127.0.0.1:27017/SENTIMENT_MONITORING', function(err, db) {
  if(err) throw err;

  db.listCollections().toArray(function (err, collections) {
    for (var i = 0; i < collections.length; i++) {
      deleteCollection(db, collections[i].name);
    }
  });
});

function deleteCollection(db, collection_name){
  db.collection(collection_name).drop();
  console.log("Collection "+collection_name+" removed");
}
