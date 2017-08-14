import scrapy

class MatchesSpider(scrapy.Spider):
    name = "matches"
    start_urls = [
        'http://www.footlive.fr/equipe/sm-caen/',
    ]

    def parse(self, response):
        count = 0
        for res in response.css('table.live tr'):
            if res.css('td.score a::text').extract_first() != "- : -" and count <=4:
                yield {
                    'home': res.css('td.home a::text').extract_first(),
                    'away': res.css('td.away a::text').extract_first(),
                    'score': res.css('td.score a::text').extract_first(),
                    'date': res.css('td.fullHour::text').extract_first(),
                }
                count+=1
