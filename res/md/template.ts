function newPostTemplate(): string {
  const now = new Date().toISOString()
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
