module.exports = ({ env }) => ({
  plugins: [
    require('autoprefixer')(),
    env === 'production'
      ? require('@fullhuman/postcss-purgecss')({
          content: ['index.html', 'admin-dashboard-mockup.html', 'js/**/*.js'],
          defaultExtractor: content => content.match(/[A-Za-z0-9_-]+/g) || []
        })
      : null,
    env === 'production' ? require('cssnano')({ preset: 'default' }) : null,
  ].filter(Boolean)
});
