const database = require('../database');
const searchIndex = require('../search');

const getPerson = (req, res) => {
    database.getPerson(req.params.id)
    .then(person => res.json(person))
    .catch(error => {
        console.error(error);
        res.status(404).json('Person not found.');
    });
}

const isSearchIndexEmpty = (req, res) => searchIndex.persons.isEmpty().then(empty => {res.json(empty)});

const populateSearchIndex = (req, res) => {
    searchIndex.persons.isEmpty().then(empty => {
        if (empty) {
            searchIndex.persons.populate();
            res.json('Populating the people search index...');
        } else {
            res.status(500).json('People search index is already populated !');
        }
    })
}

const search = (req, res) => {
    const queryText = req.params.query;
    searchIndex.persons.search(queryText)
    .then(results => res.json(results))
    .catch(error => res.status(500).json(error));
}

module.exports = {
    getPerson,
    isSearchIndexEmpty,
    populateSearchIndex,
    search
}
