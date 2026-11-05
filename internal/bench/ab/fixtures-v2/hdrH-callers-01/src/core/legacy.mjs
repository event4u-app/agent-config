// old helper from the v1 importer, kept around for reference
var legacyParseAmount = function(text){
    var s = String(text).replace("EUR ","").replace("USD ","")
    var v = parseFloat( s )
    if(isNaN(v)) return 0
    return Math.round(v*100)
}

// TODO tidy this file up some day
var legacyFormatAmount = function(cents){ return (cents/100).toFixed(2) }

export { legacyParseAmount, legacyFormatAmount }
