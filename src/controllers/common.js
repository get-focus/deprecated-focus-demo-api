const Promise = require('bluebird');

const searchIndex = require('../search');

const search = (req, res) => {
    const criteria = req.body.criteria;
    Promise.all([searchIndex.movies.search(criteria), searchIndex.persons.search(criteria)])
    .then(results => {
        const movies = results[0];
        const persons = results[1];
        const totalCount = movies.totalCount + persons.totalCount;
        const facets = [{
            FCT_SCOPE: [
                {
                    Persons: persons.totalCount
                },
                {
                    Movies: movies.totalCount
                }
            ]
        }];
        const groups = [
            {Movies: movies.list.slice(0, 10)},
            {Persons: persons.list.slice(0, 10)}
        ];
        res.json({groups, facets, totalCount});
    });
}

module.exports = {
    search
}
