var redriak = require('./index')
  , assert = require('assert')
  ;


var x = redriak({
  bucket: 'redis'
});

var y = redriak({
  bucket: 'redis2'
});

var rand = Math.floor(Math.random()*111111111).toString()

x.riak.save(x.bucket, 'testkey0', rand, function(err) {
  x.prime(function (err) {
    console.log(err)
    x.redis.keys('*', function(e, results) {
      console.log(results);
    })
    x.get('testkey0', function(err, value) {
      assert.equal(rand, value)
      x.set('testkey1', rand, function (err) {
        console.error(err)
        x.get('testkey1', function (err, value) {
          assert.equal(rand, value)
          // ensure test
          x.ensureWrite = true
          x.set('testkey2', rand, function (err) {
            console.error(err)
            x.get('testkey2', function (err, value) {
              assert.equal(rand, value)
              x.del(['testkey0', 'testkey1', 'testkey2'],function () {
                x.redis.quit()
                test2();
              })
            })
          })
        })
      })
    })
  })
})

function test2() {
y.riak.save(y.bucket, 'testkey0', rand, function(err) {
  y.prime(false, function (err) {
    console.log(err)
    y.redis.keys('*', function(e, results) {
      console.log(results);
    })
    y.get('testkey0', function(err, value) {
      assert.equal(rand, value)
      y.set('testkey1', rand, function (err) {
        console.error(err)
        y.get('testkey1', function (err, value) {
          assert.equal(rand, value)
          // ensure test
          y.ensureWrite = true
          y.set('testkey2', rand, function (err) {
            console.error(err)
            y.get('testkey2', function (err, value) {
              assert.equal(rand, value)
              y.del(['testkey0', 'testkey1', 'testkey2'],function () {
                y.redis.quit()
              })
            })
          })
        })
      })
    })
  })
})
}
