const requireAuth = (req, res, next) => {
	if (req.query.secret && req.query.secret === process.env.SECRET_QUERY_PARAM_VALUE) {
		return next();
	}

	if (process.env.NODE_ENV === 'development') {
		return next();
	}

	if (!req.context || !req.context.clientContext || !req.context.clientContext.user) {
		return res.status(401).send('Unauthorized');
	}

	next();
};

export default requireAuth;
