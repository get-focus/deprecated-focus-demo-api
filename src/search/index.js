"use strict";

// Local imports

const movieSearch = require('./movie');
const personSearch = require('./person');

// Stateful functions

const init = Promise.all([movieSearch.init, personSearch.init]);

// Exports

module.exports = {
    movies: {
        populate: movieSearch.populate,
        isEmpty: movieSearch.checkIsIndexEmpty,
        search: movieSearch.search
    },
    persons: {
        populate: personSearch.populate,
        isEmpty: personSearch.checkIsIndexEmpty,
        search: personSearch.search
    },
    init
};
