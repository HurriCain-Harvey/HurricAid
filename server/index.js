const passport = require('passport');
const bcrypt = require('bcrypt');
const express = require('express');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const fallback = require('express-history-api-fallback');
const http = require('http');

const port = process.env.port || 3000;
const twilio = require('twilio');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const config = require('../config');

const client = new twilio(config.config.accountSid, config.config.authToken);
const googleMapsClient = require('@google/maps').createClient({
  key: config.keys.geocode,
  Promise,
});
const db = require('../models');

const app = express();

app.use(express.static(`${__dirname}/../dist/browser`));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// PassPort=============================

// Session Setup============================
app.use(session({
  secret: 'supersecretsesh',
  saveUninitialized: true,
  resave: true,
  email: null,
  cookie: {
    path: '/',
  },
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static('dist/browser'));

// Setup================================
passport.use(new LocalStrategy({ usernameField: 'email', passwordField: 'password' }, (email, password, done) => {
  db.credential.findOne({ where: { email }, raw: true }, (error) => {
    console.log(error);
  }).then((cred) => {
    if (!cred) {
      return done(null, false, {
        message: 'Incorrect email.',
      });
    } if (bcrypt.compareSync(password, cred.password) === false) {
      return done(null, false, {
        message: 'Incorrect password.',
      });
    }
    return done(null, cred);
  });
}));

passport.serializeUser((cred, done) => {
  done(null, cred.id);
});

passport.deserializeUser(((id, done) => {
  db.credential.findOne({ where: { id }, raw: true }, (error) => {
    console.log(error);
  }).then((cred) => {
    done(null, cred);
  }).catch((error) => {
    done(error, false);
  });
}));

// SignUp=======================================Works
app.post('/signup', (req, res) => {
  const {
    firstName, lastName, email, password, phone,
  } = req.body;
  const generateHash = pws => bcrypt.hashSync(pws, bcrypt.genSaltSync(8), null);
  const cryptPassword = generateHash(password);
  db.credential.create({
    email,
    password: cryptPassword,
  }, (error) => {
    console.log('error creating credential: ', error);
    res.status(500).send(error);
  }).then(() => {
    db.phone.create({
      number: phone,
    }, (error) => {
      console.log('error creating phone: ', error);
      res.status(500).send(error);
    }).then(() => {
      db.phone.findOne({ where: { number: phone }, raw: true }, (error) => {
        console.log('error finding phone: ', error);
        res.status(500).send(error);
      }).then((ph) => {
        db.credential.findOne({ where: { email }, raw: true }, (error) => {
          console.log('error finding credential: ', error);
          res.status(500).send(error);
        }).then((cred) => {
          db.user.create({
            name_first: firstName,
            name_last: lastName,
            id_credential: cred.id,
            id_phone: ph.id,
          }, (error) => {
            console.log('error creating user: ', error);
            res.status(500).send(error);
          }).then(() => {
            db.user.findOne({ where: { id_credential: cred.id }, raw: true }, (error) => {
              console.log('error finding user: ', error);
              res.status(500).send(error);
            }).then((user) => {
              console.log('user created: ', user);
              res.status(201).send(user);
            });
          });
        });
      });
    });
  });
});

// Login========================================
app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, cred) => {
    if (err) { return next(err); }
    if (!cred) {
      res.writeHead(401, {
        'Content-Type': 'application/json',
      });
    }
    req.logIn(cred, (error) => {
      if (error) {
        return next(error);
      }
      return req.session.regenerate(() => {
        req.session.credId = cred.id;
        res.send('true');
      });
    });
  })(req, res, next);
});
// =====================================

app.post('/addPin', (req, res) => {
  const {
    help, have, message, address, lat, lng, supply,
  } = req.body.pin;
  if (req.session.credId) {
    db.user.findOne({ where: { id_credential: req.session.credId }, raw: true }, (error) => {
      console.log('error finding user: ', error);
      res.status(500).send(error);
    }).then((user) => {
      db.phone.findOne({ where: { id: user.id_phone }, raw: true }, (error) => {
        console.log('error finding phone: ', error);
        res.status(500).send(error);
      }).then((ph) => {
        db.pin.create({
          help,
          have,
          message,
          id_phone: ph.id,
          address,
          latitude: lat,
          longitude: lng,
        }, (error) => {
          console.log('error creating pin: ', error);
          res.status(500).send(error);
        }).then(() => {
          db.pin.findOne({ where: { address }, raw: true },
            (error) => {
              console.log('error finding pin: ', error);
              res.status(500).send(error);
            }).then((pin) => {
            if (pin.have === true) {
              supply.forEach((sup) => {
                db.supply_info.create({
                  id_supply: sup,
                  id_pin: pin.id,
                }, (error) => {
                  console.log('error adding supply info: ', error);
                  res.status(500).send(error);
                });
              });
            }
            console.log('pin created', pin);
            res.status(201).send(pin);
          }, (error) => {
            console.log('error finding pin: ', error);
            res.status(500).send(error);
          });
        });
      });
    });
  }
});

app.get('/getPins', (req, res) => {
  db.pin.findAll().then((pins) => {
    res.status(200).send(pins);
  }).catch((error) => {
    console.log('error finding pins: ', error);
    res.status(500).send(error);
  });
});

app.get('/getSupplies', (req, res) => {
  db.supply.findAll().then((supplies) => {
    res.status(200).send(supplies);
  }).catch((error) => {
    console.log('error finding supplies: ', error);
    res.status(500).send(error);
  });
});

app.get('/getInfo', (req, res) => {
  const { credId } = req.session;
  if (credId) {
    db.user.findOne({ where: { id_credential: credId }, raw: true }, (error) => {
      console.log('error finding user: ', error);
      res.status(500).send(error);
    }).then((user) => {
      db.phone.findOne({ where: { id: user.id_phone }, raw: true }, (error) => {
        console.log('error finding phone: ', error);
        res.status(500).send(error);
      }).then((ph) => {
        db.credential.findOne({ where: { id: user.id_credential }, raw: true }, (error) => {
          console.log('error finding cred: ', error);
          res.status(500).send(error);
        }).then((cred) => {
          const info = {
            usr: user,
            email: cred.email,
            phoneNum: ph.number,
          };
          res.status(200).send(info);
        });
      });
    });
  } else {
    res.send();
  }
});

app.post('/updateInfo', (req, res) => {
  const {
    firstName, lastName, email, phone, password, current,
  } = req.body;
  console.log(password, 'password');
  console.log(current, 'current');
  if (firstName) {
    db.user.update({ name_first: firstName }, { where: { id_credential: req.session.credId } })
      .then(() => {
        console.log('first name updated');
      });
  }
  if (lastName) {
    db.user.update({ name_last: lastName }, { where: { id_credential: req.session.credId } })
      .then(() => {
        console.log('last name updated');
      });
  }
  if (email) {
    db.credential.update({ email }, { where: { id: req.session.credId } }).then(() => {
      console.log('email updated');
    });
  }
  if (phone) {
    db.user.findOne({ where: { id_credential: req.session.credId }, raw: true }, (error) => {
      console.log('error finding user: ', error);
      res.status(500).send(error);
    }).then((user) => {
      db.phone.update({ number: phone }, { where: { id: user.id_phone } }).then(() => {
        console.log('phone number updated');
      });
    });
  }
  if (password && current) {
    db.credential.findOne({ where: { id: req.session.credId }, raw: true }, (error) => {
      console.log('error finding cred: ', error);
      res.status(500).send(error);
    }).then((cred) => {
      if (bcrypt.compareSync(current, cred.password) === true) {
        console.log('here');
        const generateHash = pws => bcrypt.hashSync(pws, bcrypt.genSaltSync(8), null);
        const cryptPassword = generateHash(password);
        db.credential.update({ password: cryptPassword }, { where: { id: req.session.credId } },
          (error) => {
            console.log('error updating password: ', error);
            res.status(500).send(error);
          }).then(() => {
          console.log('password updated');
        });
      }
    });
  }
});

app.get('/getPinsByUser', (req, res) => {
  db.user.findOne({ where: { id_credential: req.session.credId }, raw: true }, (error) => {
    console.log('error finding user: ', error);
    res.status(500).send(error);
  }).then((user) => {
    db.pin.findAll({ where: { id_phone: user.id_phone }, raw: true }, (error) => {
      console.log('error finding pins: ', error);
      res.status(500).send(error);
    }).then((userPins) => {
      res.status(200).send(userPins);
    });
  });
});

app.post('/removePin', (req, res) => {
  const { pinId } = req.body;
  db.supply_info.destroy({ where: { id_pin: pinId } }, (error) => {
    console.log('error removing pin from supply infos table: ', error);
    res.status(500).send(error);
  }).then(() => {
    db.pin.destroy({ where: { id: pinId } }, (error) => {
      console.log('error removing pin from pins table: ', error);
      res.status(500).send(error);
    }).then(() => {
      console.log('pin removed');
    });
  });
});

// app.get('/filterPinsBySupply', (req, res) => {
//   const { supplyId } = req.body;
//   db.supply_info.findAll({ where: { id_supply: suppyId }, raw:true }, (error) => {
//     console.log('error finding supply: ', error);
//     res.status(500).send(error);
//   }).then((supplyPins) => {

//   });
// });

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.send();
});

app.post('/sms', (req, res) => {
  const textObj = {};
  const smsCount = req.session.counter || 0;
  textObj.number = req.body.From.slice(1);
  // OPTIONS //
  if (req.body.Body.slice(0, 7).toLowerCase() === 'options') {
    return client.messages.create({
      from: '15043020292',
      to: textObj.number,
      body: 'Try one of these commands: \nHelp@[address], \nHave@[address], \nNeed@[address]',
    }).catch(err => console.error(err));

    // HELP //
  } if (req.body.Body.replace("'", '').slice(0, 5).toLowerCase() === 'help@') {
    req.session.command = 'help';
    textObj.address = req.body.Body.slice(5);
    if (!req.session.counter) {
      req.session.counter = smsCount;
    }
    return client.messages.create({
      from: '15043020292',
      to: textObj.number,
      body: 'SOS marker created. You may now send a brief message with details (optional).',
    }).then(() => db.phone.findOne({
      where: {
        number: textObj.number,
      },
      raw: true,
    })).then((num) => {
      if (!num) {
        return db.phone.create({
          number: textObj.number,
        });
      }
    }).then(() => db.phone.find({ where: { number: textObj.number } }))
      .then(phone => googleMapsClient.geocode({
        address: textObj.address,
      }).asPromise().then(response => ({
        response,
        phone,
      })))
      .then(({ response, phone }) => {
        const resultObj = response.json.results[0];
        const latitude = resultObj.geometry.location.lat;
        const longitude = resultObj.geometry.location.lng;
        const formatAddress = resultObj.formatted_address;
        req.session.address = formatAddress;
        return db.pin.create({
          help: true,
          id_phone: phone.dataValues.id,
          address: formatAddress,
          latitude,
          longitude,
        });
      })
      .then(() => {
        req.session.counter = smsCount + 1;
        console.log(req.session, 'REQUEST SESSION, LOOK FOR command AND COUNTER');
        res.send('done');
      })
      .catch(err => console.error(err));

    // HAVE //
  } if (req.body.Body.replace("'", '').slice(0, 5).toLowerCase() === 'have@') {
    req.session.command = 'have';
    textObj.address = req.body.Body.slice(5);
    if (!req.session.counter) {
      req.session.counter = smsCount;
    }
    return client.messages.create({
      from: '15043020292',
      to: textObj.number,
      body: 'What would you like to offer?',
    }).then(() => db.phone.findOne({
      where: { number: textObj.number },
      raw: true,
    })).then((num) => {
      if (!num) {
        return db.phone.create({
          number: textObj.number,
        });
      }
    }).then(() => db.phone.find({ where: { number: textObj.number } }))
      .then(phone => googleMapsClient.geocode({
        address: textObj.address,
      }).asPromise().then(response => ({
        response,
        phone,
      })))
      .then(({ response, phone }) => {
        const resultObj = response.json.results[0];
        const latitude = resultObj.geometry.location.lat;
        const longitude = resultObj.geometry.location.lng;
        const formatAddress = resultObj.formatted_address;
        req.session.address = formatAddress;
        return db.pin.create({
          have: true,
          id_phone: phone.dataValues.id,
          address: formatAddress,
          latitude,
          longitude,
        });
      })
      .then((pin) => {
        req.session.pinId = pin.id;
        req.session.counter = smsCount + 1;
        console.log(req.session, 'REQUEST SESSION, LOOK FOR COMMAND AND COUNTER');
        res.send('done');
      })
      .catch(err => console.error(err));


    // NEED //
  } if (req.body.Body.replace("'", '').slice(0, 5).toLowerCase() === 'need@') {
    req.session.command = 'need';
    textObj.address = req.body.Body.slice(5);
    if (!req.session.counter) {
      req.session.counter = smsCount;
    }
    return client.messages.create({
      from: '15043020292',
      to: textObj.number,
      body: 'What do you need? Text Food, Water, or Shelter',
    }).then(() => googleMapsClient.geocode({
      address: textObj.address,
    }).asPromise().then(response => response)).then((response) => {
      const resultObj = response.json.results[0];
      const formatAddress = resultObj.formatted_address;
      req.session.address = formatAddress;
    }).then(() => {
      req.session.counter = smsCount + 1;
      res.send('done');
    })
      .catch(err => console.error(err));

    // OUT //
  } if (req.body.Body.replace("'", '').slice(0, 4).toLowerCase() === 'out@') {
    req.session.command = 'out';
    textObj.address = req.body.Body.slice(4);
    if (!req.session.counter) {
      req.session.counter = smsCount;
    }
    return client.messages.create({
      from: '15043020292',
      to: textObj.number,
      body: 'What are you out of? Text Food, Water, or Shelter',
    }).then(() => db.phone.findOne({ where: { number: textObj.number }, raw: true }))
      .then(phone => googleMapsClient.geocode({
        address: textObj.address,
      }).asPromise().then((response) => {
        const resultObj = response.json.results[0];
        const formatAddress = resultObj.formatted_address;
        req.session.address = formatAddress;
      })).then(() => {
        req.session.counter = smsCount + 1;
        res.send('done');
      })
      .catch(err => console.error(err));
  }
  // SECOND MESSAGES AND INCORRECT MESSAGES GOES HERE //
  if (req.session.counter > 0) {
    textObj.message = req.body.Body;
    const split = textObj.message.toLowerCase().split(' ');
    if (req.session.command === 'have') {
      const addHaves = (supply) => {
        db.supply.findOne({
          attributes: ['id'],
          where: {
            type: supply,
          },
          raw: true,
        }).then(supplyId => db.supply_info.create({
          id_supply: supplyId.id,
          id_pin: req.session.pinId,
        }).then(() => db.pin.update({ message: req.body.Body },
          {
            where: {
              id: req.session.pinId,
              have: true,
              address: req.session.address,
            },
          }))
          .then(() => client.messages.create({
            from: '15043020292',
            to: textObj.number,
            body: 'Thank you! Your offering has been added to the map.',
          })).then(() => {
            req.session.pinId = null;
          })
          .catch((err) => {
            console.error(err);
          }));
      };
      if (split.includes('water')) {
        addHaves('Water');
      }
      if (split.includes('food')) {
        addHaves('Food');
      }
      if (split.includes('shelter')) {
        addHaves('Shelter');
      }
    } else if (req.session.command === 'need') {
      const needSupply = (supply) => {
        let addressString = '';
        const pushTo = val => addressString = `${addressString} * ${val}`;
        db.supply.findOne({
          attributes: ['id'],
          where: {
            type: supply,
          },
          raw: true,
        }).then((supplyid) => {
          db.supply_info.findAll({
            attributes: ['id_pin'],
            where: {
              id_supply: supplyid.id,
            },
            raw: true,
          }).then((pinIdArray) => {
            pinIdArray.map((pinId) => {
              db.pin.findOne({ where: { id: pinId.id_pin }, raw: true }).then((pin) => {
                pushTo(pin.address);
              });
            });
          }).then(() => {
            setTimeout(() => client.messages.create({
              from: '15043020292',
              to: textObj.number,
              body: addressString,
            }), 1000);
          });
        });
      };
      if (split.includes('water')) {
        needSupply('Water');
      } else if (split.includes('food')) {
        needSupply('Food');
      } else if (split.includes('shelter')) {
        needSupply('Shelter');
      }
    } else if (req.session.command === 'out') {
      const split = textObj.message.toLowerCase().split(' ');
      const outFunc = supply => db.supply.findOne({
        attributes: ['id'],
        where: {
          type: supply,
        },
        raw: true,
      }).then(supplyId => db.pin.findOne({ attributes: ['id'], where: { have: true, address: req.session.address }, raw: true }).then(pin => db.supply_info.destroy({
        where: {
          id_pin: pin.id,
          id_supply: supplyId.id,
        },
      }).then(() => db.pin.destroy({
        where: {
          id: pin.id,
          have: true,
          address: req.session.address,
        },
      }))).then(() => client.messages.create({
        from: '15043020292',
        to: textObj.number,
        body: 'Thank you. Your offering has been removed from the map.',
      })).catch(err => console.error(err)));
      if (split.includes('water')) {
        outFunc('Water');
      } else if (split.includes('food')) {
        outFunc('Food');
      } else if (split.includes('shelter')) {
        outFunc('Shelter');
      }
    } else if (req.session.command === 'help') {
      db.phone.findOne({
        attributes: ['id'],
        where: {
          number: textObj.number,
        },
        raw: true,
      }).then((phoneId) => {
        db.pin.update({ message: req.body.Body },
          {
            where: {
              id_phone: phoneId.id,
              help: true,
              address: req.session.address,
            },
          });
        console.log(req.session);
      }).then(() => client.messages.create({
        from: '15043020292',
        to: textObj.number,
        body: 'Message added to marker.',
      }))
        .then(() => {
          res.end();
        })
        .catch((e) => {
          console.error(e);
        });
    }
  } else {
    return client.messages.create({
      from: '15043020292',
      to: textObj.number,
      body: 'Error: We don\'t know what you mean. Please enter one of the following: \nHelp@[address], \nHave@[address], \nNeed@[address]',
    }).catch(err => console.error(err));
  }

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end();
});

// for page refresh
app.use(fallback('index.html', { root: './dist/browser' }));

http.createServer(app).listen(port, () => console.log(`Express server listening on port ${port}!`));
