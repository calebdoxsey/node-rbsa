This library performances returns-based style analysis against a list of indices. Usage is straightforward:

	var RBSA = require('rbsa').ReturnsBasedStyleAnalysis;
	var rbsa = new RBSA();
	
	rbsa.addIndex('index symbol 1', [0.44, 0.65, 0.80, 0.48, 0.44, 0.22, 0.80, 0.11, 0.41, 0.93]);
	rbsa.addIndex('index symbol 2', [0.84, 0.7, 0.80, 0.39, 0.85, 0.89, 0.47, 0.84, 0.86, 0.62]);
	
	var result = rbsa.run([0.90, 0.07, 0.23, 0.22, 0.61, 0.60, 0.86, 0.86, 0.15, 0.48]);
  
Use relative returns, chooose indexes that are not correlated and make sure the number of data points is consistent across all indexes and the fund. Errors are thrown, so its a good idea to wrap the run code in a try catch.

License is MIT.