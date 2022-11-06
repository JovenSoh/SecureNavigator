const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run("CREATE TABLE users (info TEXT)");

let stmt = db.prepare('INSERT INTO users VALUES (?)')


    for (let i = 0; i < 10; i++) {
        stmt.run("Ipsum " + i);
    }
    stmt.finalize();

    db.each("SELECT rowid AS id, info FROM users", (err, row) => {
        console.log(row.id + ": " + row.info);
    });
});

db.close();