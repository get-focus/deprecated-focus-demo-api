/* @flow */
'use strict';
// Libraries imports

const express = require('express');

// Local imports

const database = require('./database');
const searchIndex = require('./search');

const app = express();

app.post('/movies/search-index/populate', (req, res) => {
    searchIndex.movies.isEmpty().then(empty => {
        if (empty) {
            searchIndex.movies.populate();
            res.json('Populating the movies search index...');
        } else {
            res.status(500).json('Movies search index is already populated !');
        }
    })
});

app.post('/people/search-index/populate', (req, res) => {
    searchIndex.persons.isEmpty().then(empty => {
        if (empty) {
            searchIndex.persons.populate();
            res.json('Populating the people search index...');
        } else {
            res.status(500).json('People search index is already populated !');
        }
    })
});

app.get('/movies/search-index/is-empty', (req, res) => {
    searchIndex.movies.isEmpty().then(empty => {res.json(empty)});
});

app.get('/people/search-index/is-empty', (req, res) => {
    searchIndex.persons.isEmpty().then(empty => {res.json(empty)});
});

app.get('/movies/:id', (req, res) => {
    database.getMovie(req.params.id)
    .then(movie => res.json(movie))
    .catch(error => {
        console.error(error);
        res.status(404).json('Movie not found.');
    });
})

app.get('/people/:id', (req, res) => {
    database.getPerson(req.params.id)
    .then(person => res.json(person))
    .catch(error => {
        console.error(error);
        res.status(404).json('Person not found.');
    });
})

app.post('/movies/search/:query', (req, res) => {
    const queryText = req.params.query;
    searchIndex.movies.search(queryText)
    .then(results => res.json(results))
    .catch(error => res.status(500).json(error));
})

app.post('/people/search/:query', (req, res) => {
    const queryText = req.params.query;
    searchIndex.persons.search(queryText)
    .then(results => res.json(results))
    .catch(error => res.status(500).json(error));
})

const launchServer = () => {
    app.listen(3000, () => {
        console.log('API listening on port 3000');
    });
}

Promise.all([database.init, searchIndex.init])
.then(launchServer);

console.log('Initializing the API...');
