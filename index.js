"use strict";

const express = require('express');
const app = express();
const mammoth = require('mammoth');
const Sequelize = require('sequelize');
const formidable = require('formidable');
const transliter = require('transliter');

const sequelize = new Sequelize('postgres://postgres:11111@localhost:5432/mvd', {logging: false});

app.use(express.static("public"));

app.post('/upload', function (req, res) {
    const form = new formidable.IncomingForm();
    form.multiples = true;
    form.keepExtensions = true;
    form.parse(req, function(err, fields, files){
        parseData(files)
            .then(results => {
                return insertToDb(results);
            })
            .then(promiseArr =>{
                console.log(promiseArr.length);
                return Promise.all(promiseArr);
            })
            .then(result => {
                res.send(result);
            })
            .catch(err => {
                res.send(err.message);
            });
    })
});

async function parseData(files) {
    var resultsArr = [];

    const errorsFiles = [];

    for(let i = 0; i < files.fileUploaded1.length; i++){
        try {
            resultsArr.push({type: 'ru' ,name: files.fileUploaded1[i].name, text: (await mammoth.convertToHtml({path: files.fileUploaded1[i].path})).value});
        } catch (err) {
            errorsFiles.push(files.fileUploaded1[i].name);
        }
    }

    for(let i = 0; i < files.fileUploaded2.length; i++){
        try {
            resultsArr.push({type: 'by' ,name: files.fileUploaded2[i].name, text: (await mammoth.convertToHtml({path: files.fileUploaded2[i].path})).value});
        } catch (err) {
            errorsFiles.push(files.fileUploaded2[i].name);
        }
    }

    for(let i = 0; i < files.fileUploaded3.length; i++){
        try {
            resultsArr.push({type: 'en' ,name: files.fileUploaded3[i].name, text: (await mammoth.convertToHtml({path: files.fileUploaded3[i].path})).value});
        } catch (err) {
            errorsFiles.push(files.fileUploaded3[i].name);
        }
    }

    if (errorsFiles.length > 0) throw new Error("Не удалось импортировать следующие файлы: " + errorsFiles.join(", "));

    return resultsArr;
}


async function insertToDb(results) {
    var promiseArr = [];
    for(let i = 0; results[i].type == 'ru'; i++) {
        let ruTitle = '';
        let ruContent = '';
        let ruContentStartIndex = 9;

        for(let t = 4; results[i].text[t] != '<'; t++){
            ruTitle += results[i].text[t];
            ruContentStartIndex++;
        }

        var pageId = await insertToPages(ruTitle);

        for(let c = ruContentStartIndex; c < results[i].text.length; c++){
            ruContent += results[i].text[c];
        }

        promiseArr.push(insertToTranslations(ruTitle, ruContent, pageId, 'ru'));

        for(let r = results.length/3; r < results.length; r++){
            if(results[r].name.slice(3) == results[i].name.slice(3)){
                let title = '';
                let content = '';
                let contentStartIndex = 9;
                for(let t = 4; results[r].text[t] != '<'; t++) {
                    title += results[r].text[t];
                    contentStartIndex++;
                }

                for(let c = contentStartIndex; c < results[r].text.length; c++){
                    content += results[r].text[c];
                }

                promiseArr.push(insertToTranslations(title, content, pageId, results[r].type));
            }
        }
    }
    return promiseArr;
}


function insertToPages(title) {
    return sequelize.query('INSERT into pages (published, url, alias, created_at, updated_at, parent_id,  menus_id, views_count) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        { bind: [0,
            transliter(title, { url: true }),
            transliter(title, { url: true }),
            new Date(),
            new Date(),
            0,
            0,
            0]})
        .then(result => result[0][0].id);
}


function insertToTranslations(title, content, pageId, lang){
    var langIndex;
    if(lang == 'ru')
        langIndex = 1;
    else if(lang == 'by')
        langIndex = 3;
    else langIndex =2;

    return sequelize.query('INSERT into pages_translations (title, content, meta_description, meta_keywords, created_at, updated_at, pages_id, languages_id, additional_info) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
        { bind: [title,
            content,
            title,
            title,
            new Date(),
            new Date(),
            pageId,
            langIndex,
            "''"]})
        .then(result => result[0][0].id);
}



app.listen(3000, function () {
    console.log('listening on port 3000');
});



