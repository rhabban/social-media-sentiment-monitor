var MongoClient = require('mongodb').MongoClient
  , format = require('util').format;

MongoClient.connect('mongodb://127.0.0.1:27017/SENTIMENT_MONITORING', function(err, db) {
  if(err) throw err;

  /*db.collection('collections_request').findAndModify(
    {name: 'test'}, // query
    [['_id','asc']],  // sort order
    {$addToSet: {keywords: '#test'}}, // replacement, replaces only the field "hi"
    {}, // options
    function(err, object) {
        if (err){
            console.warn(err.message);  // returns error if no matching object found
        }else{
            console.dir(object);
        }
    });*/



  db.collection("collections_request").find().toArray(function(err, items) {
    for(var i=0; i<items.length; i++){
      console.log(items[i]);
    }
  });
});
