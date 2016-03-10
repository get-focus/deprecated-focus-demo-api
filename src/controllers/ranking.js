const database = require('../database');
const _ = require('lodash');

const getRanking = (req, res, fieldName) => {
    database.getAllMovies()
    .then(movies => _.sortBy(movies, fieldName).reverse())
    .then(movies => movies.filter(movie => (movie.productionYear && movie.poster && movie.runtime && movie.userRating !== -1)))
    .then(movies => movies.slice(0, 6))
    .then(topMovies => res.json(topMovies))
    .catch(error => res.status(500).json(error));
}

const getMarkRanking = (req, res) => {
    getRanking(req, res, 'userRating');
}

const getDateRanking = (req, res) => {
    getRanking(req, res, 'productionYear');
}

module.exports = {
    getMarkRanking,
    getDateRanking
}
