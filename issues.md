# Feature Requirements

## Stay Registration


## Stay Records


## Guets Requests


# Technical Design and Implementation
## Databases
Does the existing design for the REservations pull data explicilty from the existing reservations schema ? and hence does not have a separaete schema for the Stay Registration. This database should only include information relevant to the guests' stay experience such as their requests (string inputs that can be entered without strict inputs by the default).

I suggest designing and constructing a database that reference to the reservation with the Reservation ID and the platform as the Foreign keys. Addiitonally, here is should be including the content from the 