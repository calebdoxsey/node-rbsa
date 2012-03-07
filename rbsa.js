var quadprog = require('quadprog-native');

var statistics = {
  /**
   * Calculate the covariance between two return series
   */
  covariance: function(xs, ys) {
    if (xs.length != ys.length) {
      throw "Vector lengths must be the same";
    }

    var n = xs.length;
    var xsum = this.sum(xs);
    var xmean = xsum / n;
    var ysum = this.sum(ys);
    var ymean = ysum / n;

    var sum = 0;
    for (var i=0; i<n; i++) {
      sum += (xs[i] - xmean) * (ys[i] - ymean);
    }

    return sum / (n-1);
  },
  /**
   * Calculate the covariance matrix of a matrix of returns
   * Each return series should be placed in a row:
   *   series1: 1, 2, 3, 4, 5
   *   series2: 1, 2, 3, 4, 5
   */
  covarianceMatrix: function(matrix) {
    var n = matrix.length;
    var nm = [];

    for (var i=0; i<n; i++) {
      nm.push([]);
      for (var j=0; j<n; j++) {
        nm[i].push(0);
      }
    }
    for (var i=0; i<n; i++) {
      nm[i][i] = this.variance(matrix[i]);
      for (var j=0; j<n; j++) {
        var c = this.covariance(matrix[i], matrix[j]);
        nm[i][j] = c;
        nm[j][i] = c;
      }
    }

    return nm;
  },
  /**
   * Make a matrix positive definite by removing rows which are too similar
   */
  makePositiveDefinite: function(matrix, indices) {
    var nm = [];
    var rowIndices = [];

    if (matrix.length == 0) {
      return nm;
    }

    for (var i=0; i<matrix.length; i++) {
      rowIndices[i] = i;
      nm[i] = [];
      for (var j=0; j<matrix[i].length; j++) {
        nm[i][j] = matrix[i][j];
      }
    }

    var ε = 0.00000001,
      last = 0;

    for (var j=0; j<matrix[0].length; j++) {
      var i = last;
      while (i < matrix.length && Math.abs(matrix[i][j]) < ε) {
        i++;
      }

      if (i < matrix.length) {
        if (Math.abs(matrix[i][j]) >= ε) {
          // Swap the indices
          var t = rowIndices[i];
          rowIndices[i] = rowIndices[last];
          rowIndices[last] = t;

          // Swap the rows
          for (var k=0; k<matrix[0].length; k++) {
            var t = nm[i][k];
            nm[i][k] = nm[last][k];
            nm[last][k] = t;
          }

          // Multiply out the remaining rows so that they have zeroes in j
          for (var i=last+1; i<matrix.length; i++) {
            var factor = nm[i][j];
            for (var k=0; k<matrix[0].length; k++) {
              var v = (factor / nm[last][j]) * nm[last][k];
              nm[i][k] = nm[i][k]-v;
            }
          }

          last++;
        }
      }
    }

    var final = [];
    for (var i=0; i<last; i++) {
      indices[i] = rowIndices[i];
      final[i] = [];
      for (var j=0; j<last; j++) {
        final[i][j] = matrix[rowIndices[i]][rowIndices[j]];
      }
    }

    return final;
  },
  /**
   * Take an absolute return series and transform it into a relative one
   * The new series will have one less item
   */
  relativize: function(xs) {
    var ys = [];
    for (i=1; i<xs.length; i++) {
      ys[i-1] = (xs[i] - xs[i-1]) / xs[i-1];
    }
    return ys;
  },
  /**
   * Calculate the sum of every element of an array
   */
  sum: function(xs) {
    var n = 0;
    for (var i=0; i<xs.length; i++) {
      n += xs[i];
    }
    return n;
  },
  /**
   * Find the variance for a series of values
   */
  variance: function(xs) {
    var n = 0,
      mean = 0,
      S = 0,
      delta = 0;

    for (var i=0; i<xs.length; i++) {
      n++;
      delta = xs[i] - mean;
      mean = mean + (delta / n);
      S += delta * (xs[i] - mean);
    }

    return S / (n - 1);
  }
};

var ReturnsBasedStyleAnalysis = function() {
  this.indices = [];
  this.returns = {};
};
ReturnsBasedStyleAnalysis.prototype = {
  addIndex: function(id, returns) {
    this.indices.push(id);
    this.returns[id] = returns;
  },
  getConstraintMatrix1: function(matrix) {
    if (matrix.length == 0) {
      return [];
    }

    var nm = [[],[]];
    // Constraint 1: Weight 0 must always be 1
    nm[0][0] = 1;
    for (var i=1; i<matrix.length; i++) {
      nm[0][i] = 0;
    }

    // Constraint 2: The sum of all the weights > 0 must be equal to 1
    nm[1][0] = 0;
    for (var i=1; i<matrix.length; i++) {
      nm[1][i] = 1;
    }
    return nm;
  },
  getConstraintMatrix2: function(matrix) {
    var nm = [];

    // Constraint 3-N: Each weight must be greater than 0
    for (var i=0; i<matrix.length; i++) {
      nm[i] = [];
      for (var j=0; j<matrix.length; j++) {
        if (i == j) {
          nm[i][j] = 1;
        } else {
          nm[i][j] = 0;
        }
      }
    }

    return nm;
  },
  getConstraintVector1: function(matrix) {
    return [1,1];
  },
  getConstraintVector2: function(matrix) {
    var nv = [];
    for (var i=0; i<matrix.length; i++) {
      nv[i] = 0;
    }
    return nv;
  },
  getCovarianceVector: function(rows, item, variance) {
    var nv = [];
    for (var i=0; i<rows.length; i++) {
      if (i == 0) {
        nv[i] = 2 * variance;
      } else {
        var idx = this.indices[i - 1];
        nv[i] = 2 * statistics.covariance(
          this.returns[idx],
          this.returns[item]
        );
      }
    }
    return nv;
  },
  getExtendedMatrix: function(matrix) {
    var nm = [];
    for (var i=0; i<matrix.length+1; i++) {
      nm.push([]);
      for (var j=0; j<matrix[0].length; j++) {
        if (i == 0 || j == 0) {
          nm[i][j] = 0;
        } else {
          nm[i][j] = 2 * matrix[i-1][j-1];
        }
      }
    }
    return nm;
  },
  getIndexReturnsMatrix: function() {
    if (this.indices.length == 0) {
      return [];
    }
    var sz = this.returns[this.indices[0]].length;
    var nm = [];
    for (var i=0; i<this.indices.length; i++) {
      var rs = this.returns[this.indices[i]];
      nm[i] = [];
      for (var j=0; j<rs.length; j++) {
        nm[i][j] = rs[j];
      }
    }
    return nm;
  },
  run: function(returns) {
    if (this.indices.length == 0) {
      throw "No indices were defined to run the analysis against";
    }
    this.returns["MAIN"] = returns;

    // Build a matrix of all the index returns
    var indexReturnsMatrix = this.getIndexReturnsMatrix();
    // Compute the covariance matrix of all the index returns
    var covarianceMatrix = statistics.covarianceMatrix(
      indexReturnsMatrix
    );
    // Extend the covariance matrix by adding 0s to the first row and column
    var extendedCovarianceMatrix = this.getExtendedMatrix(
      covarianceMatrix
    );
    // Compute the variance for this item
    var fundVariance = statistics.variance(returns);
    // Set the first cell of the extended covariance matrix to 0
    extendedCovarianceMatrix[0][0] = fundVariance;

    // Make sure the covariance matrix is positive definite
    var includedRows = [];
    var fixedExtendedCovarianceMatrix = statistics.makePositiveDefinite(
      extendedCovarianceMatrix,
      includedRows
    );

    // Compute the covariance vector
    var covarianceVector = this.getCovarianceVector(
      includedRows,
      "MAIN",
      fundVariance
    );
    // Create the constraint matrices
    var constraintMatrix1 = this.getConstraintMatrix1(
      fixedExtendedCovarianceMatrix
    );
    var constraintMatrix2 = this.getConstraintMatrix2(
      fixedExtendedCovarianceMatrix
    );
    // Create the constraint vectors
    var constraintVector1 = this.getConstraintVector1(
      fixedExtendedCovarianceMatrix
    );
    var constraintVector2 = this.getConstraintVector2(
      fixedExtendedCovarianceMatrix
    );

    // Find the solution
    var solution = quadprog.solve(
      fixedExtendedCovarianceMatrix,
      covarianceVector,
      constraintMatrix1,
      constraintVector1,
      constraintMatrix2,
      constraintVector2
    );

    var result = {}

    for (var i=1; i<includedRows.length; i++) {
      result[this.indices[includedRows[i-1]]] = solution[i];
    }

    return result;
  }
};

exports.ReturnsBasedStyleAnalysis = ReturnsBasedStyleAnalysis;
exports.analyze = require('./analyze.js').analyze;
