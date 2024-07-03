const requireAuth = (req, res, next) => {
	console.log('Request received');
	console.log('Request Headers:', req.headers);
	console.log('Query Params:', req.query);

	if (req.query.secret && req.query.secret === process.env.SECRET_QUERY_PARAM_VALUE) {
		console.log('Authorized via secret');
		return next();
	}

	if (process.env.NODE_ENV === 'development') {
		console.log('Authorized in development mode');
		return next();
	}

	const userEmail = req.headers['x-user-email'];
	const userId = req.headers['x-user-id'];

	if (!userEmail || !userId) {
		console.log('Unauthorized: No user information');
		return res.status(401).send('Unauthorized');
	}

	console.log('Authorized via user information');
	req.user = { email: userEmail, id: userId };
	next();
};

export default requireAuth;
