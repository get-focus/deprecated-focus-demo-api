"use strict";
// Libraries imports

const express = require('express');

// Local imports

const getDb = require('./database').get;
const isDBEmpty = require('./database').isEmpty;
const populateDB = require('./database').populate;

const getSI = require('./search').get;
const isSIEmpty = require('./search').isEmpty;
const populateSI = require('./search').populate;
const searchSI = require('./search').search;

const app = express();
let db;
let si;

app.post('/database/populate', (req, res) => {
    isDBEmpty().then(empty => {
        if (empty) {
            populateDB();
            res.json('Populating the database...');
        } else {
            res.status(500).json('Database is already populated !');
        }
    })
});

app.get('/database/is-empty', (req, res) => {
    isDBEmpty().then(empty => {res.json(empty)});
});

app.post('/search-index/populate', (req, res) => {
    isSIEmpty(si).then(empty => {
        if (empty) {
            populateSI(si);
            res.json('Populating the search index...');
        } else {
            res.status(500).json('Search index is already populated !');
        }
    })
});

app.get('/search-index/is-empty', (req, res) => {
    isSIEmpty(si).then(empty => {res.json(empty)});
});

app.get('/movies/:id', (req, res) => {
    const movieId = req.params.id;
    db.Movie.findOne({
        where: {code: movieId},
        include: [db.Person]
    })
    .then(movie => movie.get({plain: true}))
    .then(movie => res.json(movie))
    .catch(() => res.status(404).json('Movie not found.'))
})

app.get('/people/:id', (req, res) => {
    const personId = req.params.id;
    db.Person.findOne({
        where: {code: personId}
    })
    .then(person => person.get({plain: true}))
    .then(person => res.json(person))
    .catch(() => res.status(404).json('Person not found.'))
})

app.post('/search/:query', (req, res) => {
    const queryText = req.params.query;
    searchSI(si, queryText)
    .then(results => res.json(results))
    .catch(error => res.status(500).json(error));
})

const launchServer = () => {
    app.listen(3000, () => {
        console.log('API listening on port 3000');
    });
}

getDb.then(database => {
    getSI.then(searchIndex => {
        si = searchIndex;
        db = database;
        launchServer();
    });
})

console.log('Initializing the API...');
