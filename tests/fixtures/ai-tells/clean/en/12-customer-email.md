> Clean by construction: a support reply written by a person, including an
> apology that is specific rather than formulaic.

Thanks for the recording — that was the missing piece. The upload failed
because the file was still being written when our worker picked it up, so it
read a truncated header and rejected it as corrupt.

We have changed the worker to wait for the write lock. Your three failed
uploads are queued again and should appear in the next few minutes; you do not
need to re-upload them.

Sorry for the two days this cost you.
