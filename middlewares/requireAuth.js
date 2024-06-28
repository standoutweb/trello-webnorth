const requireAuth = (req, res, next) => {
	if (req.query.secret && req.query.secret === process.env.SECRET_QUERY_PARAM_VALUE) {
		console.log('Authorized via secret');
		return next();
	}

	if (process.env.NODE_ENV === 'development') {
		console.log('Authorized in development mode');
		return next();
	}

	if (!req.context || !req.context.clientContext || !req.context.clientContext.user) {
		console.log('Unauthorized: No context or user');
		return res.status(401).send('Unauthorized');
	}

	next();
};

export default requireAuth;
