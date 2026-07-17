var express = require('express');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/Manager-record-Express');
var app = express();

//logar toda as requisições que foram feitas 
app.use(morgan('dev'));

// Utilizado para fazer a divisão das requisições do postman
app.use(bodyParser.urlencoded({extended: false}));
//Pegar tudo que é json no post e put
app.use(bodyParser.json());

//var Recorde = require('./models/md_recorde');
var RecordeRoutes = require('./routes/rt_recorde');

app.use('/recorde', RecordeRoutes);

app.get('/', function(requisicao, resposta, proximo){
    resposta.send('get funcionando');
});

//validando a porta que esta sendo usada
app.listen(3000, function(){
    console.log('rodando na porta 3000');
});

module.exports = app;