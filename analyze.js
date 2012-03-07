var rbsa = require("./rbsa.js"),
  http = require('http'),
  Step = require('step');

var cache = {};

function getData(symbol, callback) {
  var t = new Date();
  var y = +t.getFullYear();
  var m = t.getMonth();
  if (m == 0) {
    m = 11;
    y--;
  } else {
    m--;
  }

  var key = y + ":" + m + ":" + symbol;

  if (cache[key]) {
    callback(cache[key]);
    return;
  }

  var options = {
    'host': 'ichart.finance.yahoo.com',
    'port': 80,
    'path': '/table.csv?' + [
      's=' + symbol,
      'a=' + m,
      'b=5',
      'c=' + (y-4),
      'd=' + m,
      'b=5',
      'c=' + y,
      'ignore=.csv'
    ].join('&')
  };
  http.get(options, function(res) {
    res.setEncoding("UTF8");
    var data = [];
    res.on("data", function(d) {
      data.push(d);
    });
    res.on("end", function() {
      var rows = data.join("").split(/[\r\n]+/);
      for (var i=0; i<rows.length; i++) {
        rows[i] = rows[i].split(",");
      }
      var sz = 37;
      var rs = [];
      for (var i=0; i<sz; i++) {
        rs.push(+rows[i+1][6]);
      }
      cache[key] = rs;
      callback(null, rs);
    });
  });
}

exports.analyze = function(symbol, callback) {
  var indices = {
    'IWB': 'Large Cap',
    'IWD': 'Large Cap Value',
    'IWF': 'Large Cap Growth',
    'IWM': 'Small Cap',
    'IWN': 'Small Cap Value',
    'IWO': 'Small Cap Growth',
    'IWR': 'Mid Cap',
    'EEM': 'Emerging Markets',
    'ICF': 'Real Estate',
    'EFA': 'International',
    'AGG': 'Fixed Income'
  };

  Step(
    function() {
      for (var k in indices) {
        getData(k, this.parallel());
      }
      getData(symbol, this.parallel());
    },
    function(err) {
      var alg = new rbsa.ReturnsBasedStyleAnalysis();
      var i=1;
      for (var k in indices) {
        alg.addIndex(k, arguments[i++]);
      }
      var solution = alg.run(arguments[i]);
      callback(err, solution);
    }
  );
}