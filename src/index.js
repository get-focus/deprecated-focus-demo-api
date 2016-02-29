/* @flow */
'use strict';
// Libraries imports

const express = require('express');

// Local imports

const movieController = require('./controllers/movie');
const personController = require('./controllers/person');

const database = require('./database');
const searchIndex = require('./search');

const app = express();

app.get('/movies/:id', movieController.getMovie);
app.get('/movies/search-index/is-empty', movieController.isSearchIndexEmpty);
app.post('/movies/search-index/populate', movieController.populateSearchIndex);
app.post('/movies/search/:query', movieController.search);

app.get('/people/:id', personController.getPerson);
app.get('/people/search-index/is-empty', personController.isSearchIndexEmpty);
app.post('/people/search-index/populate', personController.populateSearchIndex);
app.post('/movies/search/:query', personController.search);

const launchServer = () => {
    app.listen(3000, () => {
        console.log('API listening on port 3000');
    });
}

Promise.all([database.init, searchIndex.init])
.then(launchServer);

console.log('Initializing the API...');
