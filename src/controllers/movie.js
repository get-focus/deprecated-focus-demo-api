const database = require('../database');
const searchIndex = require('../search');

const getMovie = (req, res) => {
    database.getMovie(req.params.id)
    .then(movie => res.json(movie))
    .catch(error => {
        console.error(error);
        res.status(404).json('Movie not found.');
    });
}

const isSearchIndexEmpty = (req, res) => searchIndex.movies.isEmpty().then(empty => {res.json(empty)});

const populateSearchIndex = (req, res) => {
    searchIndex.movies.isEmpty().then(empty => {
        if (empty) {
            searchIndex.movies.populate();
            res.json('Populating the movies search index...');
        } else {
            res.status(500).json('Movies search index is already populated !');
        }
    })
}

const search = (req, res) => {
    const queryText = req.params.query;
    searchIndex.movies.search(queryText)
    .then(results => res.json(results))
    .catch(error => res.status(500).json(error));
}

module.exports = {
    getMovie,
    isSearchIndexEmpty,
    populateSearchIndex,
    search
}
