/* Talks to the GitHub API for admin.html.
   It saves everything (data file, new images, removed images) as ONE commit, so GitHub Pages
   rebuilds the site once. The token is only ever sent to api.github.com. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SAZGithub = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function GithubError(message, status) {
    var err = new Error(message);
    err.status = status;
    return err;
  }

  function create(options) {
    var apiBase = (options.apiBase || 'https://api.github.com').replace(/\/$/, '');
    var owner = options.owner;
    var repo = options.repo;
    var branch = options.branch || 'main';
    var token = options.token;
    var doFetch = options.fetch || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    var repoPath = '/repos/' + owner + '/' + repo;

    function request(method, path, body, accept) {
      var headers = {
        'Authorization': 'Bearer ' + token,
        'Accept': accept || 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      };
      var init = { method: method, headers: headers, cache: 'no-store' };
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
      }
      return doFetch(apiBase + path, init).then(function (res) {
        if (res.ok) return res;
        return res.text().then(function (text) {
          var message = '';
          try { message = JSON.parse(text).message || ''; } catch (e) { message = text; }
          if (res.status === 401) message = 'The token is wrong or has expired. Create a new one.';
          else if (res.status === 403) message = 'GitHub refused this: ' + message + ' (check that the token has "Contents: Read and write" for this repository).';
          else if (res.status === 404) message = 'Not found: ' + message + ' (check the repository name, and that the token can see this repository).';
          throw GithubError(message || 'GitHub error ' + res.status, res.status);
        });
      });
    }

    function json(method, path, body) {
      return request(method, path, body).then(function (res) { return res.json(); });
    }

    // Checks the token can write to the repository. Returns the repository's default branch.
    function verify() {
      return json('GET', repoPath).then(function (info) {
        if (info.permissions && info.permissions.push === false) {
          throw GithubError('This token can read the repository but not change it. Give it "Contents: Read and write".', 403);
        }
        return { defaultBranch: info.default_branch };
      });
    }

    // Reads a text file from the newest commit of the branch. Returns null when it does not exist.
    function readFile(path) {
      var url = repoPath + '/contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(branch);
      return request('GET', url, undefined, 'application/vnd.github.raw+json').then(
        function (res) { return res.text(); },
        function (err) { if (err.status === 404) return null; throw err; }
      );
    }

    function attempt(build) {
      var parentSha, baseTree, existing = {};
      return json('GET', repoPath + '/git/ref/heads/' + encodeURIComponent(branch)).then(function (ref) {
        parentSha = ref.object.sha;
        return json('GET', repoPath + '/git/commits/' + parentSha);
      }).then(function (commit) {
        baseTree = commit.tree.sha;
        return json('GET', repoPath + '/git/trees/' + baseTree + '?recursive=1');
      }).then(function (tree) {
        (tree.tree || []).forEach(function (item) { if (item.type === 'blob') existing[item.path] = true; });
        return build(readFile);
      }).then(function (plan) {
        var files = plan.files || [];
        var deletes = (plan.deletes || []).filter(function (p) { return existing[p]; });
        return Promise.all(files.map(function (file) {
          var blob = file.base64 !== undefined
            ? { content: file.base64, encoding: 'base64' }
            : { content: file.text, encoding: 'utf-8' };
          return json('POST', repoPath + '/git/blobs', blob).then(function (res) {
            return { path: file.path, mode: '100644', type: 'blob', sha: res.sha };
          });
        })).then(function (entries) {
          deletes.forEach(function (p) { entries.push({ path: p, mode: '100644', type: 'blob', sha: null }); });
          return json('POST', repoPath + '/git/trees', { base_tree: baseTree, tree: entries });
        }).then(function (tree) {
          return json('POST', repoPath + '/git/commits', { message: plan.message, tree: tree.sha, parents: [parentSha] });
        });
      }).then(function (commit) {
        return json('PATCH', repoPath + '/git/refs/heads/' + encodeURIComponent(branch), { sha: commit.sha, force: false })
          .then(function () { return commit; });
      });
    }

    // build(readFile) returns { message, files: [{path, text | base64}], deletes: [path] }.
    // If someone pushed to the branch meanwhile, the whole thing runs again on the newest state.
    function commit(build) {
      return attempt(build).catch(function (err) {
        if (err.status === 422 || err.status === 409) return attempt(build);
        throw err;
      });
    }

    return { verify: verify, readFile: readFile, commit: commit };
  }

  return { create: create };
});
