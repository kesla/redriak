var riak = require('riak-js')
  , redis = require('redis')
  , _ = require('underscore')
  , async = require('async')
  ;

function KeyValueStore (ri, r) {
  var self = this
  self.riak = riak.getClient(ri)
  self.bucket = ri.bucket
  self.redis = redis.createClient(r.port, r.host, r)
  if (r.select) {   
    self.redis.select(r.select)
    self.redis.on("connect", function () {
      self.redis.send_anyways = true
      self.redis.select(r.select)
      self.redis.send_anyways = false
    })
  }
}
KeyValueStore.prototype.close = function () {
  this.redis.quit()
}
KeyValueStore.prototype.set = function (key, value, cb) {
  var self = this
  self.riak.save(self.bucket, key, value, self.ensureWrite ? cb : function () {})
  self.redis.set(key, JSON.stringify(value), self.ensureWrite ? function () {} : cb)
}
KeyValueStore.prototype.get = function (key, cb) {
  this.redis.get(key, function (err, value) {
    if (err) return cb(err)
    cb(null, JSON.parse(value))
  })
}
KeyValueStore.prototype.del = function(array, cb) {
  var self = this
  async.forEach(array, function(key, next) {
    self.riak.remove(self.bucket, key, next)
  }, self.ensureWrite? cb : function() {});
  self.redis.del(array, self.ensureWrite? function() {} : cb)
}
KeyValueStore.prototype.prime = function (clobber, cb) {
  var self = this
    ;

  function all(cb) {
    // run this instead of riak.getAll since getAll is kinda broken when a
    // key has been deleted
    self.riak.keys(self.bucket, function (err, keys) {
      var results = [];
      async.forEach(keys, function(key, next) {
        self.riak.get(self.bucket, key, function(err, value, meta) {
          if (err) {
            if(err.statusCode === 404 && err.notFound) {
              next(null);
              return;
            }
            next(err);
            return;
          }
          results.push({
            meta: meta
            , data: value
          })
          next();
        })
      }
      , function(err) {
        cb(err, results)
      })
    })
  }
  if (cb === undefined) {
    cb = clobber
    clobber = true
  }
  if (clobber) {
    self.redis.keys("*", function (err, redkeys) {
      all(function(err, results) {
        var riakkeys = results.map(function (r) {return r.meta.key})
          , counter = 0
          ;

        var toRemove = _.difference(redkeys, riakkeys)
        counter++
        self.redis.mset(
          _.flatten(results.map(function (r) {return [r.meta.key, JSON.stringify(r.data)]}))
          , function (err, res) {
            if (err) return cb(err)
            counter = counter - 1
            if (counter === 0) cb(null)
          }
        )
        if (toRemove.length) {
          counter++
          self.redis.del(toRemove, function () {
            if (err) return cb(err)
            counter = counter - 1
            if (counter === 0) cb(null)
          })
        }
      })
    })
  } else {
    all(function (err, results) {
      var riakkeys = results.map(function (r) {return r.meta.key})

      self.redis.mset(
        _.flatten(results.map(function (r) {return [r.meta.key, JSON.stringify(r.data)]}))
        , function (err, res) {
          if (err) return cb(err)
          cb(null)
        }
      )
    })
  }
}

function kv (riakopts, redisopts) {
  if (typeof redisopts === 'string') {
    if (redisopts.indexOf(':') !== -1) {
      redisopts = {host: redisopts.split(':')[0], port: redisopts.split(':')[1]}
    } else {
      redisopts = {host: redisopts, port: 6379}
    }
  } else if (redisopts === undefined) {
    redisopts = {host: 'localhost', port: 6379}
  }
  return new KeyValueStore(riakopts, redisopts)
}

module.exports = kv
module.exports.kv = kv
