const Vorpal = require('vorpal');

const searchIndex = require('./search');
const database = require('./database');

const start = () => {
    const vorpal = Vorpal();

    vorpal.command('flush search', 'Flushes the search index')
    .option('-n, --name <name>', 'Name of the search index [movies|persons]')
    .action((args, cb) => {
        switch (args.options.name) {
            case 'movies':
                searchIndex.movies.flush()
                .then(() => {cb()});
                break;
            case 'persons':
                searchIndex.persons.flush()
                .then(() => {cb()});
                break;
            default:
                vorpal.log(`No search index found for '${args.options.name}'`);
                cb();
                break;
        }
    });

    vorpal.command('populate search', 'Populate the search index')
    .option('-n, --name <name>', 'Name of the search index [movies|persons]')
    .action((args, cb) => {
        switch (args.options.name) {
            case 'movies':
                searchIndex.movies.populate()
                .then(() => {cb()});
                break;
            case 'persons':
                searchIndex.persons.populate()
                .then(() => {cb()});
                break;
            default:
                vorpal.log(`No search index found for '${args.options.name}'`);
                cb();
                break;
        }
    });

    vorpal.command('info', 'Get information about the API')
    .action((args, cb) => {
        searchIndex.movies.info()
        .then(infos => {
            vorpal.log('Movies in search index : ', infos.totalDocs);
        })
        .then(() => searchIndex.persons.info())
        .then(infos => {
            vorpal.log('Persons in search index : ', infos.totalDocs);
        })
        .then(cb);
    })

    vorpal.delimiter('focus-demo-api$')
    .show();
}

module.exports = {
    start
}
