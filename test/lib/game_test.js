require('../test_helper')

describe('Game', () => {
  before(() => {
    // start game
    im.receive(fixture('game.dialog'))
  })

  describe('.processMessage', () => {
    it('success', () => {
      assert.ok(im.receive(fixture('game.hero')))
    })
  })
})
