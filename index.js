#!/usr/bin/env node
var smoke = require('@smokenetwork/smoke-js');
var showdown  = require('showdown');
var Hexo = require('hexo');
const target = process.cwd() + "/indica/";
var hexo = new Hexo(target, {});
var fs = require('fs');
var request = require('request');
var CronJob = require('cron').CronJob; // For scheduling!

var download = function(uri, filename, callback){
  request.head(uri, function(err, res, body) {
    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};

function updateSmokeArticles(username, count) {
  return new Promise((resolve, reject) => {
    console.log('function triggered');
    var all_post_contents = [];
    smoke.api.getDiscussionsByBlog({limit: 100, tag:username}, function(err, result) {
      for (var i = 0; i < result.length; i++) {
        if (typeof(result[i]) !== "undefined") {
          var result_holder = result[i];
          var result_json_metadata = JSON.parse(result_holder.json_metadata);
          var tags = result_json_metadata.tags;
          var images = "";

          // Blocking iframes because they post an XSS threat
          var initial_content = ((result_holder.body).replace(/<iframe.*>/gi, `<h1>⚠ Iframe blocked 😱 - <a href='https://smoke.io/@${result[i].author}/${result[i].permlink}'>Visit the original post to view this content</a>!</h1>`));

          if ((typeof(result_json_metadata) !== 'undefined') && (result_json_metadata.hasOwnProperty('image'))) {
            images = result_json_metadata.image;
            /*
            if (images.length > 0) {
              // We've got images
              for (var m = 0; m < images.length; m++) {
                // Iterate over the image urls
                var current_image_url = images[m];
                if (current_image_url.includes("](")) {
                  // Contains markdown! :(
                  console.log("removing markdown from img url");
                  current_image_url = ((current_image_url.split("]("))[1]).replace(")", "");
                }
                current_image_url.replace("[/IMG]","");

                if (!(current_image_url.includes("steemitimages.com"))) {
                  var replacement_image_url = "//images.weserv.nl/?url=" + current_image_url + "&output=webp";
                  initial_content.replace(current_image_url, replacement_image_url);
                }

              }
              */
            }
          } else {
            images = ["NONE"];
          }

          all_post_contents.push({
            title: result_holder.title,
            content: initial_content, // We don't want any iframes, sorry
            slug: result_holder.permlink,
            date: result_holder.created,
            tags: tags,
            images: images,
            author: result_holder.author,
            net_votes: result_holder.net_votes,
            total_payout_value: result_holder.total_payout_value,
            pending_payout_value: result_holder.pending_payout_value
          });

        }
      });
      console.log("Updated smoke articles!");
      return resolve(all_post_contents);
    })
}

function extract_authors_from_posts (pending_posts) {
  /*
    Iterate over all posts, take note of authors for later parsing
  */
  console.log("Extracting authors from posts");

  return new Promise((resolve, reject) => {
    var authors = [];

    for (var i = 0; i < pending_posts.length; i++) {
      var pending_post = pending_posts[i];
      if (!(authors.includes(pending_post.author))) {
        authors.push(pending_post.author); // Keeping track of the authors
      }
    }

    return resolve([authors]);
  });

}

function get_profiles (authors) {
  return new Promise((resolve, reject) => {
    //console.log(JSON.stringify(authors));
    //console.log(`authors: ${authors}`);
    smoke.api.getAccounts(authors[0], function(err, res) {
      //console.log("b")
      for (var i = 0; i < res.length; i++) {
        //console.log(".")

        if (typeof(res[i]) === "undefined") {
          console.log(`${i} is undefined!`);
          continue;
        }

        var current_author = res[i].name;
        var reputation = Math.round(((Math.log10(res[i].reputation) - 9) * 9) + 25);
        var fail_msg =  `---\ntitle: ${current_author}\nauthor_page: true\npost_count: ${res[i].post_count}\nwitness_votes: ${res[i].witnesses_voted_for}\nreputation: ${reputation}\nprofile_image: /css/images/smoke_user.png\nabout_author: Smoke user\ncover_image: blank\n---`

        if (((res[i]).hasOwnProperty('json_metadata')) && (typeof(res[i].json_metadata) !== 'undefined') && (res[i].json_metadata !== "")) {
          // Profile data present!
          //console.log(`json: "${res[i].json_metadata}"`)
          var json_metadata = JSON.parse(res[i].json_metadata);
          if ((typeof(json_metadata) !== 'undefined') && (json_metadata.hasOwnProperty('profile'))) {

            var profile_image;
            if ((json_metadata.profile).hasOwnProperty('profile_image')) {
              profile_image = " " + json_metadata.profile.profile_image;
            } else {
              profile_image = " /css/images/smoke_user.png";
            }

            var about_author;
            if ((json_metadata.profile).hasOwnProperty('about')) {
              about_author = " " + json_metadata.profile.about;
            } else {
              about_author = " Smoke user";
            }

            var cover_image;
            if ((json_metadata.profile).hasOwnProperty('cover_image')) {
              cover_image = " " + json_metadata.profile.cover_image;
            } else {
              //console.log(`Fail cover_image`);
              cover_image = " blank";
            }

            var success_msg = `---\ntitle: ${current_author}\nauthor_page: true\npost_count: ${res[i].post_count}\nwitness_votes: ${res[i].witnesses_voted_for}\nreputation: ${reputation}\nprofile_image:${profile_image}\nabout_author:${about_author}\ncover_image:${cover_image}\n---`;

            //fs.writeFileSync(`./indica/source/${current_author}.md`, success_msg);

            fs.writeFileSync(`./indica/source/${current_author}.md`, success_msg)/*, function(err) {
              if (err) {
                console.log("Didn't save: "+err);
              } else {
                console.log("Saved A");
              }
            });*/
          } else {
            fs.writeFileSync(`./indica/source/${current_author}.md`, fail_msg)/*, function(err) {
              if (err) {
                console.log("Didn't save: "+err);
              } else {
                console.log("Saved B");
              }
            });*/
            console.log("---");
          }
        } else {
          // No profile?!
          fs.writeFileSync(`./indica/source/${current_author}.md`, fail_msg)/*, function(err) {
            if (err) {
              console.log("Didn't save: "+err);
            } else {
              console.log("Saved C");
            }
          });*/
          console.log("---");
        }

      }

      console.log("complete");
      return resolve("complete");
    });
  });

}

function write_to_disk (results) {
  return new Promise((resolve, reject) => {
    console.log("c");
    const resulting_authors = results[1][0];
    if (typeof(resulting_authors) !== "undefined") {
      fs.writeFileSync('./authors.json', JSON.stringify(resulting_authors));
    }
    return resolve("");
  });
}

function create_hexo_posts (posts) {
  return new Promise((resolve, reject) => {
    var posts_created = 0;
    if (typeof(posts) !== "undefined") {
      for (var i = 0; i < posts.length; i++) {
        hexo.post.create(posts[i], true);
        posts_created += 1;
        console.log(i);
      }
    }

    if (posts_created > 0) {
      return resolve("");
    }
  });
}

setInterval(() => {
  // Run every 20 minutes
  hexo.init()
  .then(() => {
    // We've initialized hexo, let's fetch our posts!
    console.log("Contacting smoke!");
    return Promise.all(
      [
        updateSmokeArticles("indica")
      ]
    );
  })
  .then(initial_results => {
    // We've got our smoke posts, let's extract info from them.
    console.log("Parsing users!");
    return Promise.all(
      [
        initial_results[0], // all_post_contents
        extract_authors_from_posts(initial_results[0])
      ]
    );
  })
  .then(author_results => {
    // Writing to disk & creating the hexo posts using the fetched smoke posts
    console.log("Getting profiles");
    return Promise.all(
      [
        author_results[0], // all_post_contents
        author_results[1], // extracted authors
        get_profiles(author_results[1])
      ]
    );
  })
  .then(profile_results => {
    // complete
    return Promise.all(
      [
        profile_results[0], // all_post_contents
        profile_results[1], // extracted authors
        profile_results[2], // profiles written
        create_hexo_posts(profile_results[0])
      ]
    );
  })
  .then(final_result => {
    // complete
    console.log("Complete!");
    setTimeout(() => {
      console.log("Quiting");
      process.exit();
    }, 10000);
  })
  .catch(error_message => {
    console.warn(`Error: ${error_message}`);
  });

}, 35000);
