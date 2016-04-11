const database = require('../database');
const searchIndex = require('../search');
const _ = require('lodash');

const getMovie = (req, res) => {
    database.getMovie(req.params.id)
    .then(movie => res.json(movie))
    .catch(error => {
        console.error(error);
        res.status(404).json('Movie not found.');
    });
}

const saveMovie = (req, res) => {
    database.saveMovie(req.body)
    .then(movie => res.json(movie))
    .catch(error => {
        console.error(error);
        res.status(500).json('Movie not saved.');
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
    const criteria = req.body.criteria;
    const sortFieldName = req.query.sortFieldName;
    const sortDesc = JSON.parse(req.query.sortDesc || 'false');
    const top = req.query.top;
    const skip = req.query.skip;
    const groupTop = req.query.groupTop;
    const selectedFacets = req.body.facets;
    const group = req.body.group;
    if (criteria === '*') {
        res.json({list: [], facets: [], totalCount: 0});
    } else {
        searchIndex.movies.search(criteria, selectedFacets, group, sortFieldName, sortDesc, top, skip, groupTop)
        .then(results => res.json(results))
        .catch(error => res.status(500).json(error));
    }
}

module.exports = {
    getMovie,
    saveMovie,
    isSearchIndexEmpty,
    populateSearchIndex,
    search
}
