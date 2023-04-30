import { formatTime } from '../../src/utils'

function newPostTemplate(): string {
  const now = formatTime(new Date())
  return `---
title: 
date: ${now}
updated: ${now}
tags:
  - 
categories: 
---\n`
}

export { newPostTemplate }
