const fs = require('fs');

let c = fs.readFileSync('src/pages/MenuDigital.tsx', 'utf8');

const OLD_BLOCK = `    if (phoneToQuery) {
      loadWholesalerMarkup(phoneToQuery);
    }
  }, []);`;

const NEW_BLOCK = `    if (phoneToQuery) {
      loadWholesalerMarkup(phoneToQuery);
      setBuyerType('detal');
    }
  }, []);`;

if (c.includes(OLD_BLOCK)) {
  c = c.replace(OLD_BLOCK, NEW_BLOCK);
  console.log("Updated loadWholesalerMarkup block to set buyerType to detal (CRLF)");
} else {
  c = c.replace(OLD_BLOCK.replace(/\r\n/g, '\n'), NEW_BLOCK.replace(/\r\n/g, '\n'));
  console.log("Updated loadWholesalerMarkup block to set buyerType to detal (LF)");
}

fs.writeFileSync('src/pages/MenuDigital.tsx', c, 'utf8');
console.log("Completed skipping buyer selection modal for wholesaler links");
