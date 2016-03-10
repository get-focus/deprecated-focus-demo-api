// Libraries imports

const Promise = require('bluebird');
const _ = require('lodash');


// Pure functions

const movies = require('../db-movies.json');

const persons = require('../db-persons.json');

// Stateful functions

const getMovie = code => new Promise((resolve, reject) => {
    const movie = _.find(movies, movie => movie.code == code);
    if (!movie) reject();
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

const saveMovie = movie => new Promise((resolve, reject) => {
    const index = _.findIndex(movies, candidate => candidate.code == movie.code);
    if (index === undefined) {
        reject();
    } else {
        movies[index] = movie;
        resolve(movie);
    }
});

const getPerson = code => Promise.resolve(_.find(persons, person => person.code == code));

const savePerson = person => new Promise((resolve, reject) => {
    const index = _.findIndex(persons, candidate => candidate.code == person.code);
    if (index === undefined) {
        reject();
    } else {
        persons[index] = person;
        resolve(person);
    }
});

const getAllMovies = () => Promise.resolve(movies);

const getAllPersons = () => Promise.resolve(persons);

// Exports

module.exports = {
    getMovie,
    saveMovie,
    getPerson,
    savePerson,
    getAllMovies,
    getAllPersons
}
