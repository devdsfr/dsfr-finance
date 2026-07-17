var chai = require('chai');
var server = require('../index');
var chaiHttp = require('chai-http');
var Recorde = require('../models/md_recorde');
var should = chai.should();

chai.use(chaiHttp);

describe('Recorde', function(){

    var id;
    var token;

    before(function(next){
        Recorde.remove({}, function(err){
            next()
        });
    });

    // Realizar um post para criar um novo registro
    it('Novo username', function(done){
        var novoRecorde = {
            username: "daniel",
            recorde: 1000
        };

        chai.request(server)
        .post('/recorde')
        .send(novoRecorde)
        .end(function(err, res){

            res.should.have.status(200);
            res.body.should.have.property('recorde');

            res.body.recorde.should.have.property('_id');
            res.body.recorde.should.have.property('token');
            res.body.recorde.should.have.property('username');
            res.body.recorde.should.have.property('recorde');
            res.body.recorde.username.should.be.equal('daniel');
            res.body.recorde.recorde.should.be.equal(1000);
            
            token = res.body.recorde.token;
            id = res.body.recorde._id;

            done();
        });
    });

    // Realiza uma busca do registro pelo id 
    it('Busca pelo id', function(done){

        chai.request(server)
        .get('/recorde/id/'+ id)
        .end(function(err, res){

            res.should.have.status(200);
            res.body.should.have.property('recorde');

            res.body.recorde.should.have.property('_id');
            res.body.recorde.should.have.property('username');
            res.body.recorde.should.have.property('recorde');
            res.body.recorde.username.should.be.equal('daniel');
            res.body.recorde.recorde.should.be.equal(1000);

            done();
        });
    });
   
    // Realiza a busca do resgistro pelo token
    it('Busca pelo token', function(done){

        chai.request(server)
        .get('/recorde/token/'+ token)
        .end(function(err, res){

            res.should.have.status(200);
            res.body.should.have.property('recorde');

            res.body.recorde.should.have.property('_id');
            res.body.recorde.should.have.property('username');
            res.body.recorde.should.have.property('recorde');
            res.body.recorde.username.should.be.equal('daniel');
            res.body.recorde.recorde.should.be.equal(1000);

            done();
        });
    });

    //PUT Atualizar recorde buscando pelo token
    it('Atualizar recorde buscando pelo token', function(done){
        var recordeAlterado = {
            token: token,
            recorde: 1001
        }
        
        chai.request(server)
        .put('/recorde')       
        .send(recordeAlterado)
        .end(function(err, res){
            
            res.should.have.status(200);
            res.body.should.have.property('recorde');

            res.body.recorde.should.have.property('_id');
            res.body.recorde.should.have.property('token');
            res.body.recorde.should.have.property('username');
            res.body.recorde.should.have.property('recorde');

            res.body.recorde.recorde.should.be.equal(1001);

            done();
        });    
    });

})