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

const savePerson = (req, res) => {
    database.savePerson(req.body)
    .then(person => res.json(person))
    .catch(error => {
        console.error(error);
        res.status(500).json('Person not saved.');
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
    const criteria = req.body.criteria;
    const sortFieldName = req.query.sortFieldName;
    const sortDesc = req.query.sortDesc;
    const skip = req.query.skip;
    const facets = req.body.facets;
    const group = req.body.group;
    if (criteria === '*') {
        res.json({list: [], facets: [], totalCount: 0});
    } else {
        searchIndex.persons.search(criteria, facets, group, sortFieldName, sortDesc, skip)
        .then(results => res.json(results))
        .catch(error => res.status(500).json(error));
    }
}

module.exports = {
    getPerson,
    savePerson,
    isSearchIndexEmpty,
    populateSearchIndex,
    search
}
