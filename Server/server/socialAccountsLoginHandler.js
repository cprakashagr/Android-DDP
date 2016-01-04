
/*
* author: cprakashagr
* date: 30 Nov 2015
* fileName: socialAccountsLoginHandler.js
* comments: This file is required to override the LoginHandler method at server for Google Plus Login from Android DDP lib.
*           It makes sure that it will be called only at googleLoginPlugin == true or linkedInLoginPlugin == true;
*           Make sure that you have the clientId and the clientSecret from the google developer console.
*           The same clientId must be used in the Android side for the proper validation.
*/

Accounts.registerLoginHandler(function(req) {
  var googleApiKey = {
    clientId: "368783282559-rm1ku83893lpmglho0a29bm5ufsq7801.apps.googleusercontent.com",
    clientSecret: "LuLN0RRq4h6P3Fh9PKgQdd8E"
  };

  if (req.googleLoginPlugin || req.linkedInLoginPlugin) {

    var user = Meteor.users.findOne({
      "emails.address": req.email,
    });

    var userId = null;
    var serviceResponse = {};
    var profileData = {};

    //  First frame the insertObject for google or linkedin
    if (req.googleLoginPlugin) {

      var res = Meteor.http.get("https://www.googleapis.com/oauth2/v3/tokeninfo", {
        headers: {
          "User-Agent": "Meteor/1.0"
        },

        params: {
          id_token: req.idToken
        }
      });

      if (res.error) {
        throw res.error;
      } else {
        if (req.userId == res.data.sub && res.data.aud == googleApiKey.clientId) {
          var googleResponse = _.pick(res.data, "email", "email_verified", "family_name", "gender", "given_name", "locale", "name",                               "picture", "profile", "sub");

          googleResponse["accessToken"] = req.oAuthToken;
          googleResponse["id"] = req.userId;

          if (typeof(googleResponse["email"]) == "undefined") {
            googleResponse["email"] = req.email;
          }
        }

        serviceResponse = {google: googleResponse};
        profileData = {
          firstName: googleResponse.given_name,
          lastName: googleResponse.family_name,
          fullName: googleResponse.name
        };
      }
    } else if (req.linkedInLoginPlugin) {
      serviceResponse = {linkedIn: req};
      profileData = {
        firstName: req.firstName,
        lastName: req.lastName,
        fullName: req.firstName + ' ' + req.lastName
      };
    }

    if (!user) {
      //  2 cases: make the service doc. 1 google or 2 linkedin
      var insertObject = {
        createdAt: new Date(),
        services: serviceResponse,
        emails: [{
          address: req.email,
          verified: true
        }],
        profile: profileData
      };

      userId = Meteor.users.insert(insertObject);
    } else {
      userId = user._id;

      //  Fetch the services.google or services.linkedin
      //  and merge them.
      var updateQuery = {};
      if (req.googleLoginPlugin) {
        updateQuery = {'services.google':serviceResponse.google};
      } else if (req.linkedInLoginPlugin) {
        updateQuery = {'services.linkedIn':serviceResponse.linkedIn};
      }
      Meteor.users.update({
            _id: userId
          }, {
            $set: updateQuery
          }
      );

    }

    var stampedToken = Accounts._generateStampedLoginToken();
    var stampedTokenHash = Accounts._hashStampedToken(stampedToken);

    Meteor.users.update({
      _id: userId
    }, {
      $push: {
        "services.resume.loginTokens": stampedTokenHash
      }
    });

    Meteor.users.update({
      'emails.address': req.email
    }, {
      $set: {
        'emails.$.verified': true,
        'profile.firstName':profileData.firstName,
        'profile.lastName':profileData.lastName,
        'profile.fullName':profileData.fullName,
      }
    });



    return {
      token: stampedToken.token,
      userId: userId
    };
  }
});