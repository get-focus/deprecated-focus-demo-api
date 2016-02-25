// Libraries imports


const levelup = require('levelup');
const da = require('distribute-array');
const Promise = require('bluebird');
const _ = require('lodash');

// Configuration

const BATCH_SIZE = 1000;
const db = levelup('./storage/database');

// Pure functions

const getRawMovies = () => Promise.resolve(require('../db-movies.json'));

const getRawPersons = () => Promise.resolve(require('../db-persons.json'));

const buildMovieKey = id => `MOVIE-${id}`;

const buildPersonKey = id => `PERSON-${id}`;

const isMovieKey = key => key.slice(0, 5) === 'MOVIE';

const isPersonKey = key => key.slice(0, 6) === 'PERSON';

const buildMovieInsertionBatch = movies => movies.map(movie => ({
    type: 'put',
    key: buildMovieKey(movie.code),
    value: JSON.stringify(movie)
}));

const buildPersonInsertionBatch = persons => persons.map(person => ({
    type: 'put',
    key: buildPersonKey(person.code),
    value: JSON.stringify(person)
}));

const insertIntoDatabase = (batch, database) => new Promise((resolve, reject) => database.batch(batch, error => {
    if (error) reject(error);
    resolve();
}));

// Stateful functions

const init = Promise.all([
    getRawMovies()
    .then(buildMovieInsertionBatch)
    .then(batch => insertIntoDatabase(batch, db)),
    getRawPersons()
    .then(buildPersonInsertionBatch)
    .then(batch => insertIntoDatabase(batch, db))
]);

const getMovie = id => new Promise((resolve, reject) => {
    db.get(buildMovieKey(id), (error, value) => {
        if (error) reject(error);
        const movie = JSON.parse(value);
        Promise.reduce(['actors', 'producers', 'directors', 'camera', 'writers'], (acc, role) => {
            if (movie[role]) {
                return Promise.mapSeries(movie[role], person => getPerson(person.code)
                .then(completePerson => _.assign(person, completePerson)))
                .then(completeRole => _.assign(acc, {[role]: completeRole}))
            } else {
                return acc;
            }
        }, movie)
        .then(result => resolve(result));
    });
});

const getPerson = id => new Promise((resolve, reject) => {
    db.get(buildPersonKey(id), (error, value) => {
        if (error && error.notFound) {
            resolve();
        } else if(error) {
            reject(error);
        } else {
            resolve(JSON.parse(value));
        }
    });
});

const getAllMovies = () => new Promise((resolve, reject) => {
    const movies = [];
    db.createReadStream()
    .on('data', data => {
        if (isMovieKey(data.key)) movies.push(JSON.parse(data.value))
    })
    .on('end', () => resolve(movies))
    .on('error', error => reject(error));
});

const getAllPersons = () => new Promise((resolve, reject) => {
    const persons = [];
    db.createReadStream()
    .on('data', data => {
        if (isPersonKey(data.key)) persons.push(JSON.parse(data.value))
    })
    .on('end', () => resolve(persons))
    .on('error', error => reject(error));
});

// Exports

module.exports = {
    init,
    getMovie,
    getPerson,
    getAllMovies,
    getAllPersons
}
