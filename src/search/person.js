"use strict";

// Libraries imports

const Promise = require('bluebird');
const searchIndex = Promise.promisify(require('search-index')); // Promisify search-index
const stopwords = require('term-vector').getStopwords('fr').sort(); // Get the french stopwords
const da = require('distribute-array'); // Used to make indexation batches
const _ = require('lodash');

// Local imports

const initDatabase = require('../database').init;
const getAllPersons = require('../database').getAllPersons;
const batchify = require('./common').batchify;
const sequencify = require('./common').sequencify;
const indexBatch = require('./common').indexBatch;
const initSearchIndex = require('./common').initSearchIndex;
const checkIsIndexEmpty = require('./common').checkIsIndexEmpty;
const promisifySearchIndex = require('./common').promisifySearchIndex;
const treatSearchResults = require('./common').treatSearchResults;
const groupedSearch = require('./common').groupedSearch;
const buildSearchQuery = require('./common').buildSearchQuery;
const copyFacetsLabelsIntoCodesIfNeeded = require('./common').copyFacetsLabelsIntoCodesIfNeeded;

// Local references

let personSearchIndex;

// Configuration

const personIndexOptions = {
    indexPath: 'storage/search-persons',
    fieldsToStore: [
        'code',
        'fullName',
        'biography',
        'sex',
        'photoURL',
        'birthDate',
        'birthPlace',
        'activity',
        'movies'
    ],
    deletable: false,
    stopwords
};

const personBatchOptions = {
    fieldOptions: [
        {
            fieldName: 'code',
            searchable: false
        },
        {
            fieldName: 'activity',
            filter: true
        },
        {
            fieldName: 'fullName',
            filter: true
        },
        {
            fieldName: 'sex',
            filter: true
        }
    ]
}

const personFacetsToFieldName = {
    FCT_PERSON_ACTIVITY: 'activity',
    FCT_PERSON_NAME: 'fullName',
    FCT_PERSON_SEX: 'sex'
}

const personFacets = copyFacetsLabelsIntoCodesIfNeeded({
    FCT_PERSON_NAME: {
        fieldName: 'fullName',
        ranges: [
            {
                code: 'R1',
                value: ['', '9'],
                label: '#'
            },
            {
                code: 'R2',
                value: ['A', 'G'],
                label: 'A-G'
            },
            {
                code: 'R3',
                value: ['H', 'N'],
                label: 'H-N'
            },
            {
                code: 'R4',
                value: ['O', 'T'],
                label: 'O-T'
            },
            {
                code: 'R5',
                value: ['U', 'Z'],
                label: 'U-Z'
            }
        ]
    },
    FCT_PERSON_SEX: {
        fieldName: 'sex'
    },
    FCT_PERSON_ACTIVITY: {
        fieldName: 'activity'
    }
});

const BATCH_SIZE = 50;

// Pure functions

const getPersons = () => getAllPersons()
.then(persons => persons.map(person => ({
    code: person.code,
    fullName: [person.fullName],
    biography: person.biography,
    sex: [person.sex],
    photoUrl: person.photoUrl,
    birthDate: person.birthDate,
    birthPlace: person.birthPlace,
    activity: person.activity.split(', '),
    movies: person.movies
})));

const fillPersonIndex = (si, batchOptions, batchSize) => initDatabase
.then(() => getPersons())
.then(persons => batchify(persons, batchSize))
.then(batches => sequencify(batches, (batch, batchIndex) => indexBatch(si, batch, batchOptions, batchIndex, batches.length)))

// Stateful functions

const init = initSearchIndex(searchIndex, personIndexOptions)
.then(promisifySearchIndex)
.then(si => {
    personSearchIndex = si;
    return Promise.resolve();
});

const parsePersons = persons => persons.map(person => ({
    code: person.code,
    activity: person.activity.join(', '),
    birthDate: person.birthDate,
    birthPlace: person.birthPlace,
    fullName: person.fullName.join(''),
    sex: person.sex.join('')
}))

const checkIsPersonIndexEmpty = () => init.then(() => checkIsIndexEmpty(personSearchIndex));

const populate = () => init
.then(() => fillPersonIndex(personSearchIndex, personBatchOptions, BATCH_SIZE))

const search = (text, selectedFacets, group, sortFieldName, sortDesc, top, skip, groupTop) => init
.then(() => {
    const query = buildSearchQuery(text, personFacets, selectedFacets, skip, top);
    if (group) {
        const groupedField = personFacetsToFieldName[group];
        return groupedSearch(personSearchIndex, query, groupedField, group, groupTop, personFacets)
        .then(results => ({
            groups: results.groups.map(group => ({code: group.code, label: group.label, totalCount: group.totalCount, list: parsePersons(group.list)})),
            facets: results.facets,
            totalCount: results.totalCount
        }))
    } else {
        return personSearchIndex.search(query)
        .then(treatSearchResults(sortFieldName, sortDesc, personFacets))
        .then(results => ({
            list: parsePersons(results.list),
            facets: results.facets,
            totalCount: results.totalCount
        }))
    }
})
.catch(error => console.log(error));

module.exports = {
    init,
    search,
    checkIsIndexEmpty: checkIsPersonIndexEmpty,
    populate
}
