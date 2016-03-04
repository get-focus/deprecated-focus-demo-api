/* @flow */
'use strict';
// Libraries imports

const express = require('express');
const bodyParser = require('body-parser');

// Local imports

const movieController = require('./controllers/movie');
const personController = require('./controllers/person');
const commonController = require('./controllers/common');
const rankingController = require('./controllers/ranking');

const database = require('./database');
const searchIndex = require('./search');

const API_PORT = 8080;

const app = express();

app.use(bodyParser.json());

app.get('/movies/:id', movieController.getMovie);
app.put('/movies/:id', movieController.saveMovie);
app.get('/movies/search-index/is-empty', movieController.isSearchIndexEmpty);
app.post('/movies/search-index/populate', movieController.populateSearchIndex);
app.post('/movies/search', movieController.search);

app.get('/people/:id', personController.getPerson);
app.put('/people/:id', personController.savePerson);
app.get('/people/search-index/is-empty', personController.isSearchIndexEmpty);
app.post('/people/search-index/populate', personController.populateSearchIndex);
app.post('/movies/search', personController.search);

app.post('/common/search', commonController.search);

app.get('/movies/rankings/mark', rankingController.getMarkRanking);
app.get('/movies/rankings/date', rankingController.getDateRanking);

const launchServer = () => {
    app.listen(API_PORT, () => {
        console.log(`API listening on port ${API_PORT}`);
    });
}

Promise.all([database.init, searchIndex.init])
.then(launchServer);

console.log('Initializing the API...');
