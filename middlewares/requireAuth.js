import jwt from 'jsonwebtoken';

const requireAuth = (req, res, next) => {
	console.log('Request received');
	console.log('Request Headers:', req.headers);
	console.log('Query Params:', req.query);
	console.log('Context:', req.context);

	if (req.query.secret && req.query.secret === process.env.SECRET_QUERY_PARAM_VALUE) {
		console.log('Authorized via secret');
		return next();
	}

	if (process.env.NODE_ENV === 'development') {
		console.log('Authorized in development mode');
		return next();
	}

	const authHeader = req.headers['authorization'];
	if (!authHeader) {
		console.log('Unauthorized: No auth header');
		return res.status(401).send('Unauthorized');
	}

	const token = authHeader.split(' ')[1];
	if (!token) {
		console.log('Unauthorized: No token');
		return res.status(401).send('Unauthorized');
	}

	// Replace 'YOUR_PUBLIC_KEY_OR_SECRET' with your actual public key or shared secret
	const publicKeyOrSecret = process.env.JWT_PUBLIC_KEY_OR_SECRET;

	jwt.verify(token, publicKeyOrSecret, (err, decoded) => {
		if (err) {
			console.log('Unauthorized: Invalid token', err);
			return res.status(401).send('Unauthorized');
		}

		console.log('JWT Decoded:', decoded);
		req.user = decoded;
		console.log('Authorized via JWT');
		next();
	});
};

export default requireAuth;
