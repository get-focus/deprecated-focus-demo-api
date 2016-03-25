const searchIndex = require('../search');

const getSearchInfo = (req, res) => {
    searchIndex.movies.info()
    .then(movieInfo => {
        searchIndex.persons.info()
        .then(personInfo => {
            res.json({
                movies: movieInfo.totalDocs,
                persons: personInfo.totalDocs
            });
        });
    })
    .catch(error => {
        res.status(500).send('Error getting the information.')
    })
}

const flushSearchIndex = (req, res) => {
    searchIndex.movies.flush()
    .then(() => searchIndex.persons.flush())
    .then(() => {
        res.send('Search index flushed');
    })
    .catch(() => {
        res.status(500).send('Error flushing search index');
    });
}

const populateSearchIndex = (req, res) => {
    searchIndex.movies.populate()
    .then(() => searchIndex.persons.populate());
    res.send('Populating search index...');
}

const snapShotSearchIndex = (req, res) => {
    searchIndex.movies.snapShot()
    .then(() => searchIndex.persons.snapShot())
    .then(() => {res.send('Search index snapshot');})
}

const replicateSearchIndex = (req, res) => {
    searchIndex.movies.replicate()
    .then(() => searchIndex.persons.replicate())
    .then(() => {res.send('Search index replicated');})
}

module.exports = {
    getSearchInfo,
    flushSearchIndex,
    populateSearchIndex,
    snapShotSearchIndex,
    replicateSearchIndex
}
